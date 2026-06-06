import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit-logs/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NumberingService } from '../../common/utils/numbering.service';
import {
  businessRule,
  conflict,
  forbidden,
  invalidTransition,
  notFound,
  normalizePage,
  buildPage,
  type Page,
} from '../../common';
import {
  ApprovalStatus,
  AuditAction,
  AuditEntityType,
  InvoiceStatus,
  NotificationType,
  PoStatus,
  Prisma,
  QuotationStatus,
  UserRole,
} from '@prisma/client';
import type { ListApprovalsQueryDto } from './approvals.dto';
import type { AuthPrincipal } from '../../common';

@Injectable()
export class ApprovalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notify: NotificationsService,
    private readonly numbering: NumberingService,
  ) {}

  async list(q: ListApprovalsQueryDto, user: AuthPrincipal): Promise<Page<unknown>> {
    const { page, pageSize, skip, take } = normalizePage(q);
    const where: Prisma.ApprovalWhereInput = {};
    if (q.status) where.status = q.status;
    // Officers see only what they requested
    if (user.role === UserRole.OFFICER) where.requestedById = user.sub;
    // Managers see everything pending + items they decided
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.approval.findMany({
        where,
        orderBy: { requestedAt: 'desc' },
        skip,
        take,
        include: {
          quotation: { include: { vendor: { select: { id: true, displayName: true } } } },
          rfq: { select: { id: true, number: true, title: true } },
          requestedBy: { select: { id: true, fullName: true, email: true } },
          actedBy: { select: { id: true, fullName: true, email: true } },
        },
      }),
      this.prisma.approval.count({ where }),
    ]);
    return buildPage(rows, total, page, pageSize);
  }

  async findById(id: string) {
    const a = await this.prisma.approval.findUnique({
      where: { id },
      include: {
        rfq: { include: { lineItems: { orderBy: { lineNo: 'asc' } } } },
        quotation: { include: { vendor: true, lineItems: true } },
        requestedBy: { select: { id: true, fullName: true, email: true } },
        actedBy: { select: { id: true, fullName: true, email: true } },
        purchaseOrder: true,
        invoice: true,
      },
    });
    if (!a) throw notFound('Approval not found');
    return a;
  }

  // ============================================================
  // APPROVE  (transactional: Approval -> ACCEPTED, generate PO + Invoice, audit + notify)
  // ============================================================
  async approve(id: string, user: AuthPrincipal, ctx: { ipAddress?: string; userAgent?: string; requestId?: string }) {
    if (user.role !== UserRole.MANAGER && user.role !== UserRole.ADMIN) {
      throw forbidden('Only managers may approve');
    }
    const approval = await this.findById(id);
    if (approval.status !== ApprovalStatus.PENDING) {
      throw invalidTransition('Only PENDING approvals can be approved', { from: approval.status });
    }
    // Segregation of Duties
    if (approval.requestedById === user.sub) {
      throw forbidden('You cannot approve an approval you requested (segregation of duties)');
    }

    const taxRate = 18; // single tax rate per invoice (default 18%)

    const result = await this.prisma.$transaction(async (tx) => {
      const poNumber = await this.numbering.next('PO', tx);
      const invNumber = await this.numbering.next('INV', tx);
      // Mark approval as APPROVED
      const a = await tx.approval.update({
        where: { id: approval.id },
        data: { status: ApprovalStatus.APPROVED, actedById: user.sub, decidedAt: new Date() },
      });
      // Quotation -> ACCEPTED and locked
      const quotation = await tx.quotation.update({
        where: { id: approval.quotationId },
        data: { status: QuotationStatus.ACCEPTED, isLocked: true },
        include: { lineItems: true, vendor: true },
      });
      // Build PO line items from quotation
      const poLineItems = quotation.lineItems.map((li, idx) => ({
        lineNo: idx + 1,
        description: `Item ${idx + 1}`,
        quantity: li.quantity,
        unit: 'EA',
        unitPrice: li.unitPrice,
        lineTotal: li.lineTotal,
      }));
      const subtotal = quotation.totalAmount;
      const taxAmount = new Prisma.Decimal(subtotal).mul(taxRate).div(100);
      const grandTotal = new Prisma.Decimal(subtotal).plus(taxAmount);

      // Create PO
      const po = await tx.purchaseOrder.create({
        data: {
          number: poNumber,
          approvalId: a.id,
          vendorId: quotation.vendorId,
          quotationId: quotation.id,
          status: PoStatus.GENERATED,
          totalAmount: subtotal,
          taxRatePercent: new Prisma.Decimal(taxRate),
          taxAmount,
          grandTotal,
          currency: 'INR',
          createdById: user.sub,
          lineItems: { create: poLineItems },
          statusEvents: {
            create: {
              fromStatus: PoStatus.GENERATED,
              toStatus: PoStatus.GENERATED,
              note: 'Auto-generated on approval',
              actorId: user.sub,
            },
          },
        },
      });

      // Create Invoice
      const dueDate = new Date();
      dueDate.setUTCDate(dueDate.getUTCDate() + 30);
      const invoice = await tx.invoice.create({
        data: {
          number: invNumber,
          purchaseOrderId: po.id,
          approvalId: a.id,
          vendorId: quotation.vendorId,
          status: InvoiceStatus.PENDING,
          subtotal,
          taxRatePercent: new Prisma.Decimal(taxRate),
          taxAmount,
          grandTotal,
          currency: 'INR',
          dueDate,
          createdById: user.sub,
          lineItems: {
            create: poLineItems.map((li) => ({
              lineNo: li.lineNo,
              description: li.description,
              quantity: li.quantity,
              unitPrice: li.unitPrice,
              lineTotal: li.lineTotal,
            })),
          },
          statusEvents: {
            create: {
              fromStatus: InvoiceStatus.PENDING,
              toStatus: InvoiceStatus.PENDING,
              note: 'Auto-generated on approval',
              actorId: user.sub,
            },
          },
        },
      });

      // Lock all other quotations on this RFQ
      await tx.quotation.updateMany({
        where: { rfqId: approval.rfqId, NOT: { id: quotation.id } },
        data: { isLocked: true },
      });
      // Close the RFQ
      await tx.rfq.update({
        where: { id: approval.rfqId },
        data: { status: 'CLOSED', closedAt: new Date() },
      });

      // Audit log entries
      await this.audit.log(tx, {
        action: AuditAction.APPROVAL_APPROVED,
        entityType: AuditEntityType.APPROVAL,
        entityId: a.id,
        description: `Approval approved: quotation ${quotation.number}`,
        metadata: { quotationId: quotation.id, poId: po.id, invoiceId: invoice.id },
        actorId: user.sub,
        actorEmail: user.email,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        requestId: ctx.requestId,
      });
      await this.audit.log(tx, {
        action: AuditAction.PO_GENERATED,
        entityType: AuditEntityType.PURCHASE_ORDER,
        entityId: po.id,
        description: `PO generated: ${po.number}`,
        metadata: { number: po.number, quotationId: quotation.id, vendorId: quotation.vendorId },
        actorId: user.sub,
        actorEmail: user.email,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        requestId: ctx.requestId,
      });
      await this.audit.log(tx, {
        action: AuditAction.INVOICE_GENERATED,
        entityType: AuditEntityType.INVOICE,
        entityId: invoice.id,
        description: `Invoice generated: ${invoice.number}`,
        metadata: { number: invoice.number, poId: po.id },
        actorId: user.sub,
        actorEmail: user.email,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        requestId: ctx.requestId,
      });
      await this.audit.log(tx, {
        action: AuditAction.RFQ_CLOSED,
        entityType: AuditEntityType.RFQ,
        entityId: approval.rfqId,
        description: 'RFQ auto-closed on approval',
        actorId: user.sub,
        actorEmail: user.email,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        requestId: ctx.requestId,
      });

      // Notifications
      const requester = await tx.user.findUnique({ where: { id: approval.requestedById }, select: { id: true } });
      if (requester) {
        await this.notify.emit(tx, {
          type: NotificationType.APPROVAL_APPROVED,
          userId: requester.id,
          title: `Approval approved: ${quotation.number}`,
          message: `PO ${po.number} and Invoice ${invoice.number} generated.`,
          entityType: 'APPROVAL',
          entityId: a.id,
        });
      }
      const vendorUsers = await tx.user.findMany({
        where: { vendorCompanyId: quotation.vendorId },
        select: { id: true },
      });
      for (const vu of vendorUsers) {
        await this.notify.emit(tx, {
          type: NotificationType.PO_GENERATED,
          userId: vu.id,
          title: `New PO: ${po.number}`,
          message: `PO issued for ${quotation.number}.`,
          entityType: 'PURCHASE_ORDER',
          entityId: po.id,
        });
        await this.notify.emit(tx, {
          type: NotificationType.INVOICE_GENERATED,
          userId: vu.id,
          title: `New Invoice: ${invoice.number}`,
          message: `Invoice generated. Due ${invoice.dueDate.toISOString().substring(0, 10)}.`,
          entityType: 'INVOICE',
          entityId: invoice.id,
        });
      }
      return { approval: a, po, invoice };
    });

    return result;
  }

  // ============================================================
  // REJECT
  // ============================================================
  async reject(
    id: string,
    remarks: string,
    user: AuthPrincipal,
    ctx: { ipAddress?: string; userAgent?: string; requestId?: string },
  ) {
    if (!remarks || remarks.trim().length < 3) {
      throw businessRule('remarks are required when rejecting an approval');
    }
    if (user.role !== UserRole.MANAGER && user.role !== UserRole.ADMIN) {
      throw forbidden('Only managers may reject');
    }
    const approval = await this.findById(id);
    if (approval.status !== ApprovalStatus.PENDING) {
      throw invalidTransition('Only PENDING approvals can be rejected', { from: approval.status });
    }
    if (approval.requestedById === user.sub) {
      throw forbidden('You cannot reject an approval you requested (segregation of duties)');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const a = await tx.approval.update({
        where: { id: approval.id },
        data: { status: ApprovalStatus.REJECTED, actedById: user.sub, decidedAt: new Date(), remarks },
      });
      // Send quotation back to SUBMITTED
      await tx.quotation.update({
        where: { id: approval.quotationId },
        data: { status: QuotationStatus.SUBMITTED, isLocked: false },
      });
      await this.audit.log(tx, {
        action: AuditAction.APPROVAL_REJECTED,
        entityType: AuditEntityType.APPROVAL,
        entityId: a.id,
        description: `Approval rejected: ${remarks}`,
        metadata: { remarks },
        actorId: user.sub,
        actorEmail: user.email,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        requestId: ctx.requestId,
      });
      const requester = await tx.user.findUnique({ where: { id: approval.requestedById }, select: { id: true } });
      if (requester) {
        await this.notify.emit(tx, {
          type: NotificationType.APPROVAL_REJECTED,
          userId: requester.id,
          title: 'Approval rejected',
          message: remarks,
          entityType: 'APPROVAL',
          entityId: a.id,
        });
      }
      return a;
    });
    return result;
  }
}
