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
  ownershipDenied,
  type Page,
} from '../../common';
import {
  AuditAction,
  AuditEntityType,
  NotificationType,
  Prisma,
  QuotationStatus,
  RfqStatus,
  RfqVendorStatus,
  UserRole,
} from '@prisma/client';
import type { SubmitQuotationDto, UpdateQuotationDto, ListQuotationsQueryDto } from './quotations.dto';
import type { AuthPrincipal } from '../../common';

@Injectable()
export class QuotationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notify: NotificationsService,
    private readonly numbering: NumberingService,
  ) {}

  // ============================================================
  // SUBMIT
  // ============================================================
  async submit(
    dto: SubmitQuotationDto,
    user: AuthPrincipal,
    ctx: { ipAddress?: string; userAgent?: string; requestId?: string },
  ) {
    const rfq = await this.prisma.rfq.findUnique({
      where: { id: dto.rfqId },
      include: { lineItems: true, vendors: true },
    });
    if (!rfq) throw notFound('RFQ not found');
    if (rfq.status !== RfqStatus.PUBLISHED) {
      throw invalidTransition('Quotations can only be submitted to PUBLISHED RFQs', { rfqStatus: rfq.status });
    }
    if (rfq.deadline <= new Date()) {
      throw businessRule('RFQ deadline has passed — submissions closed');
    }

    // Determine vendor
    let vendorId: string;
    if (user.role === UserRole.VENDOR) {
      if (!user.vendorCompanyId) throw forbidden('Vendor profile not linked');
      vendorId = user.vendorCompanyId;
    } else if (user.role === UserRole.ADMIN || user.role === UserRole.OFFICER) {
      if (!dto.vendorId) throw businessRule('vendorId is required for officer/admin submission');
      vendorId = dto.vendorId;
    } else {
      throw forbidden('Only vendors or officers may submit quotations');
    }

    // Verify vendor is invited
    const rfqVendor = rfq.vendors.find((v) => v.vendorId === vendorId);
    if (!rfqVendor) {
      throw businessRule('Vendor is not invited to this RFQ');
    }

    // Check for existing quotation
    const existing = await this.prisma.quotation.findUnique({ where: { rfqVendorId: rfqVendor.id } });
    if (existing) {
      throw conflict('A quotation already exists for this vendor on this RFQ');
    }

    // Validate line items match RFQ
    const lineItemMap = new Map(rfq.lineItems.map((li) => [li.id, li]));
    for (const li of dto.lineItems) {
      if (!lineItemMap.has(li.rfqLineItemId)) {
        throw businessRule(`rfqLineItemId ${li.rfqLineItemId} does not belong to RFQ ${rfq.id}`);
      }
    }

    // Compute total
    const total = dto.lineItems.reduce((sum, li) => sum + li.unitPrice * li.quantity, 0);

    const number = await this.numbering.next('Q');

    const q = await this.prisma.$transaction(async (tx) => {
      const quotation = await tx.quotation.create({
        data: {
          rfqId: rfq.id,
          rfqVendorId: rfqVendor.id,
          vendorId,
          number,
          status: QuotationStatus.SUBMITTED,
          totalAmount: new Prisma.Decimal(total),
          deliveryDate: dto.deliveryDate,
          notes: dto.notes,
          submittedById: user.sub,
          lineItems: {
            create: dto.lineItems.map((li) => {
              const rfqLi = lineItemMap.get(li.rfqLineItemId)!;
              return {
                rfqLineItemId: li.rfqLineItemId,
                unitPrice: new Prisma.Decimal(li.unitPrice),
                quantity: new Prisma.Decimal(li.quantity),
                lineTotal: new Prisma.Decimal(li.unitPrice * li.quantity),
                notes: li.notes,
                createdById: user.sub,
              };
            }),
          },
        },
        include: { lineItems: true },
      });
      // Mark RfqVendor as responded
      await tx.rfqVendor.update({
        where: { id: rfqVendor.id },
        data: { status: RfqVendorStatus.RESPONDED, respondedAt: new Date() },
      });
      await this.audit.log(tx, {
        action: AuditAction.QUOTATION_SUBMITTED,
        entityType: AuditEntityType.QUOTATION,
        entityId: quotation.id,
        description: `Quotation submitted: ${quotation.number} for RFQ ${rfq.number}`,
        metadata: { rfqId: rfq.id, rfqNumber: rfq.number, total },
        actorId: user.sub,
        actorEmail: user.email,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        requestId: ctx.requestId,
      });
      // Notify the RFQ creator and other officers/managers
      const officers = await tx.user.findMany({
        where: { role: { in: [UserRole.ADMIN, UserRole.OFFICER] }, status: 'ACTIVE' },
        select: { id: true },
      });
      for (const o of officers) {
        await this.notify.emit(tx, {
          type: NotificationType.QUOTATION_SUBMITTED,
          userId: o.id,
          title: `New quotation: ${quotation.number}`,
          message: `Quotation submitted on RFQ ${rfq.number} (total ${total.toFixed(2)})`,
          entityType: 'QUOTATION',
          entityId: quotation.id,
        });
      }
      return quotation;
    });
    return q;
  }

  // ============================================================
  // UPDATE (before deadline, before terminal state)
  // ============================================================
  async update(
    id: string,
    dto: UpdateQuotationDto,
    user: AuthPrincipal,
    ctx: { ipAddress?: string; userAgent?: string; requestId?: string },
  ) {
    const q = await this.findById(id);
    this.assertCanEdit(q, user);

    const rfq = await this.prisma.rfq.findUnique({ where: { id: q.rfqId } });
    if (!rfq) throw notFound('RFQ not found');
    if (rfq.deadline <= new Date()) {
      throw businessRule('Cannot edit quotation after RFQ deadline');
    }
    if (q.isLocked) throw businessRule('Quotation is locked');

    const updated = await this.prisma.$transaction(async (tx) => {
      let total = q.totalAmount;
      if (dto.lineItems) {
        const lineItemMap = new Map(
          (await tx.rfqLineItem.findMany({ where: { rfqId: rfq.id } })).map((li) => [li.id, li]),
        );
        await tx.quotationLineItem.deleteMany({ where: { quotationId: q.id } });
        await tx.quotationLineItem.createMany({
          data: dto.lineItems.map((li) => {
            if (!lineItemMap.has(li.rfqLineItemId)) {
              throw businessRule(`rfqLineItemId ${li.rfqLineItemId} does not belong to RFQ ${rfq.id}`);
            }
            return {
              quotationId: q.id,
              rfqLineItemId: li.rfqLineItemId,
              unitPrice: new Prisma.Decimal(li.unitPrice),
              quantity: new Prisma.Decimal(li.quantity),
              lineTotal: new Prisma.Decimal(li.unitPrice * li.quantity),
              notes: li.notes,
              createdById: user.sub,
            };
          }),
        });
        total = new Prisma.Decimal(dto.lineItems.reduce((s, li) => s + li.unitPrice * li.quantity, 0));
      }
      const u = await tx.quotation.update({
        where: { id: q.id },
        data: {
          deliveryDate: dto.deliveryDate ?? q.deliveryDate,
          notes: dto.notes ?? q.notes,
          totalAmount: total,
        },
        include: { lineItems: true },
      });
      await this.audit.log(tx, {
        action: AuditAction.QUOTATION_UPDATED,
        entityType: AuditEntityType.QUOTATION,
        entityId: u.id,
        description: `Quotation updated: ${u.number}`,
        actorId: user.sub,
        actorEmail: user.email,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        requestId: ctx.requestId,
      });
      return u;
    });
    return updated;
  }

  async findById(id: string) {
    const q = await this.prisma.quotation.findUnique({
      where: { id },
      include: {
        lineItems: true,
        vendor: true,
        rfq: { select: { id: true, number: true, title: true, deadline: true, status: true } },
        submittedBy: { select: { id: true, fullName: true, email: true } },
        approval: true,
        files: { where: { deletedAt: null } },
      },
    });
    if (!q) throw notFound('Quotation not found');
    return q;
  }

  async list(q: ListQuotationsQueryDto, user: AuthPrincipal): Promise<Page<unknown>> {
    const { page, pageSize, skip, take } = normalizePage(q);
    const where: Prisma.QuotationWhereInput = {};
    if (q.rfqId) where.rfqId = q.rfqId;
    if (q.status) where.status = q.status;
    if (user.role === UserRole.VENDOR) {
      where.vendorId = user.vendorCompanyId ?? '__none__';
    }
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.quotation.findMany({
        where,
        orderBy: { submittedAt: 'desc' },
        skip,
        take,
        include: {
          vendor: { select: { id: true, displayName: true } },
          rfq: { select: { id: true, number: true, title: true } },
        },
      }),
      this.prisma.quotation.count({ where }),
    ]);
    return buildPage(rows, total, page, pageSize);
  }

  // ============================================================
  // SHORTLIST (officer)
  // ============================================================
  async shortlist(id: string, user: AuthPrincipal, ctx: { ipAddress?: string; userAgent?: string; requestId?: string }) {
    const q = await this.findById(id);
    if (q.status !== QuotationStatus.SUBMITTED) {
      throw invalidTransition('Only SUBMITTED quotations can be shortlisted', { from: q.status });
    }
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.OFFICER) {
      throw forbidden('Only officers may shortlist');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // Supersede any previously shortlisted quotation on this RFQ
      const previous = await tx.quotation.findFirst({
        where: { rfqId: q.rfqId, status: QuotationStatus.SHORTLISTED },
      });
      let supersededId: string | null = null;
      if (previous && previous.id !== q.id) {
        supersededId = previous.id;
        await tx.quotation.update({
          where: { id: previous.id },
          data: { status: QuotationStatus.SUBMITTED },
        });
      }
      const u = await tx.quotation.update({
        where: { id: q.id },
        data: { status: QuotationStatus.SHORTLISTED },
      });

      // Create an Approval in PENDING
      const existingApproval = await tx.approval.findUnique({ where: { quotationId: q.id } });
      const approval = existingApproval
        ? await tx.approval.update({
            where: { id: existingApproval.id },
            data: { status: 'PENDING', requestedById: user.sub, requestedAt: new Date(), decidedAt: null, actedById: null, remarks: null },
          })
        : await tx.approval.create({
            data: {
              rfqId: q.rfqId,
              quotationId: q.id,
              status: 'PENDING',
              requestedById: user.sub,
            },
          });

      await this.audit.log(tx, {
        action: AuditAction.QUOTATION_SHORTLISTED,
        entityType: AuditEntityType.QUOTATION,
        entityId: q.id,
        description: `Quotation shortlisted: ${q.number}`,
        metadata: { rfqId: q.rfqId, supersededId },
        actorId: user.sub,
        actorEmail: user.email,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        requestId: ctx.requestId,
      });
      await this.audit.log(tx, {
        action: AuditAction.APPROVAL_REQUESTED,
        entityType: AuditEntityType.APPROVAL,
        entityId: approval.id,
        description: `Approval requested for ${q.number}`,
        metadata: { quotationId: q.id, rfqId: q.rfqId },
        actorId: user.sub,
        actorEmail: user.email,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        requestId: ctx.requestId,
      });

      // Notify all active managers
      const managers = await tx.user.findMany({
        where: { role: UserRole.MANAGER, status: 'ACTIVE' },
        select: { id: true },
      });
      for (const m of managers) {
        await this.notify.emit(tx, {
          type: NotificationType.APPROVAL_REQUESTED,
          userId: m.id,
          title: `Approval requested: ${q.number}`,
          message: `An approval is awaiting your decision.`,
          entityType: 'APPROVAL',
          entityId: approval.id,
        });
      }
      return u;
    });
    return result;
  }

  // ============================================================
  // REJECT (officer)
  // ============================================================
  async reject(
    id: string,
    remarks: string,
    user: AuthPrincipal,
    ctx: { ipAddress?: string; userAgent?: string; requestId?: string },
  ) {
    if (!remarks || remarks.trim().length < 3) {
      throw businessRule('A reason is required when rejecting a quotation');
    }
    const q = await this.findById(id);
    if (q.status === QuotationStatus.ACCEPTED || q.status === QuotationStatus.REJECTED) {
      throw invalidTransition('Quotation is in a terminal state', { from: q.status });
    }
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.OFFICER) {
      throw forbidden('Only officers may reject');
    }
    const u = await this.prisma.$transaction(async (tx) => {
      const r = await tx.quotation.update({
        where: { id: q.id },
        data: { status: QuotationStatus.REJECTED },
      });
      await this.audit.log(tx, {
        action: AuditAction.QUOTATION_REJECTED,
        entityType: AuditEntityType.QUOTATION,
        entityId: q.id,
        description: `Quotation rejected: ${q.number} — ${remarks}`,
        metadata: { remarks },
        actorId: user.sub,
        actorEmail: user.email,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        requestId: ctx.requestId,
      });
      // Notify vendor users
      const vendorUsers = await tx.user.findMany({
        where: { vendorCompanyId: q.vendorId },
        select: { id: true },
      });
      for (const vu of vendorUsers) {
        await this.notify.emit(tx, {
          type: NotificationType.QUOTATION_REJECTED,
          userId: vu.id,
          title: `Quotation rejected: ${q.number}`,
          message: remarks,
          entityType: 'QUOTATION',
          entityId: q.id,
        });
      }
      return r;
    });
    return u;
  }

  // ============================================================
  // COMPARE (side-by-side data for the comparison screen)
  // ============================================================
  async compare(rfqId: string, user: AuthPrincipal) {
    if (user.role === UserRole.VENDOR) {
      throw forbidden('Only staff may compare quotations');
    }
    const rfq = await this.prisma.rfq.findUnique({
      where: { id: rfqId },
      include: { lineItems: { orderBy: { lineNo: 'asc' } } },
    });
    if (!rfq) throw notFound('RFQ not found');
    const quotations = await this.prisma.quotation.findMany({
      where: { rfqId, status: { in: [QuotationStatus.SUBMITTED, QuotationStatus.SHORTLISTED, QuotationStatus.ACCEPTED] } },
      orderBy: { totalAmount: 'asc' },
      include: { lineItems: true, vendor: { select: { id: true, displayName: true, rating: true } } },
    });
    const lowest = quotations.length > 0 ? Number(quotations[0].totalAmount) : 0;
    return {
      rfq: { id: rfq.id, number: rfq.number, title: rfq.title, lineItems: rfq.lineItems },
      quotations: quotations.map((q) => ({
        id: q.id,
        number: q.number,
        vendor: q.vendor,
        totalAmount: Number(q.totalAmount),
        deliveryDate: q.deliveryDate,
        notes: q.notes,
        status: q.status,
        isLowest: Number(q.totalAmount) === lowest,
        lineItems: q.lineItems.map((li) => ({
          rfqLineItemId: li.rfqLineItemId,
          unitPrice: Number(li.unitPrice),
          quantity: Number(li.quantity),
          lineTotal: Number(li.lineTotal),
        })),
      })),
    };
  }

  // ---- helpers ----
  private assertCanEdit(
    q: { vendorId: string; status: QuotationStatus; isLocked: boolean; submittedById: string },
    user: AuthPrincipal,
  ): void {
    if (q.isLocked) throw businessRule('Quotation is locked');
    if (q.status === QuotationStatus.ACCEPTED || q.status === QuotationStatus.REJECTED) {
      throw invalidTransition('Quotation is in a terminal state', { from: q.status });
    }
    if (user.role === UserRole.VENDOR) {
      if (q.vendorId !== user.vendorCompanyId) {
        throw ownershipDenied('You can only edit your own quotations');
      }
      if (q.submittedById !== user.sub) {
        throw ownershipDenied('You can only edit quotations you submitted');
      }
    } else if (user.role !== UserRole.ADMIN && user.role !== UserRole.OFFICER) {
      throw forbidden('You do not have permission to edit this quotation');
    }
  }
}
