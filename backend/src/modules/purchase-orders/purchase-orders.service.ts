import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit-logs/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PdfService } from '../../common/utils/pdf.service';
import {
  forbidden,
  invalidTransition,
  notFound,
  normalizePage,
  buildPage,
  ownershipDenied,
  type Page,
} from '../../common';
import { AuditAction, AuditEntityType, NotificationType, PoStatus, Prisma, UserRole } from '@prisma/client';
import type { ListPosQueryDto } from './purchase-orders.dto';
import type { AuthPrincipal } from '../../common';

@Injectable()
export class PurchaseOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notify: NotificationsService,
    private readonly pdf: PdfService,
  ) {}

  async list(q: ListPosQueryDto, user: AuthPrincipal): Promise<Page<unknown>> {
    const { page, pageSize, skip, take } = normalizePage(q);
    const where: Prisma.PurchaseOrderWhereInput = {};
    if (q.status) where.status = q.status;
    if (q.vendorId) where.vendorId = q.vendorId;
    if (user.role === UserRole.VENDOR) {
      where.vendorId = user.vendorCompanyId ?? '__none__';
    }
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.purchaseOrder.findMany({
        where,
        orderBy: { generatedAt: 'desc' },
        skip,
        take,
        include: { vendor: { select: { id: true, displayName: true } } },
      }),
      this.prisma.purchaseOrder.count({ where }),
    ]);
    return buildPage(rows, total, page, pageSize);
  }

  async findById(id: string) {
    const po = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        vendor: true,
        lineItems: { orderBy: { lineNo: 'asc' } },
        approval: { include: { quotation: { include: { rfq: true } } } },
        statusEvents: { orderBy: { occurredAt: 'asc' }, include: { actor: { select: { id: true, fullName: true, email: true } } } },
        invoice: true,
      },
    });
    if (!po) throw notFound('Purchase Order not found');
    return po;
  }

  async assertAccess(po: { vendorId: string; createdById: string }, user: AuthPrincipal): Promise<void> {
    if (user.role === UserRole.VENDOR) {
      if (po.vendorId !== user.vendorCompanyId) throw ownershipDenied('You can only access your own POs');
    }
  }

  async markSent(
    id: string,
    note: string | undefined,
    user: AuthPrincipal,
    ctx: { ipAddress?: string; userAgent?: string; requestId?: string },
  ) {
    const po = await this.findById(id);
    await this.assertAccess(po, user);
    if (po.status !== PoStatus.GENERATED) {
      throw invalidTransition('Only GENERATED POs can be sent', { from: po.status });
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const u = await tx.purchaseOrder.update({
        where: { id: po.id },
        data: { status: PoStatus.SENT, sentAt: new Date() },
      });
      await tx.poStatusEvent.create({
        data: {
          purchaseOrderId: po.id,
          fromStatus: PoStatus.GENERATED,
          toStatus: PoStatus.SENT,
          note,
          actorId: user.sub,
        },
      });
      await this.audit.log(tx, {
        action: AuditAction.PO_SENT,
        entityType: AuditEntityType.PURCHASE_ORDER,
        entityId: po.id,
        description: `PO sent: ${po.number}`,
        metadata: { note: note ?? null },
        actorId: user.sub,
        actorEmail: user.email,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        requestId: ctx.requestId,
      });
      // Notify vendor
      const vendorUsers = await tx.user.findMany({
        where: { vendorCompanyId: po.vendorId },
        select: { id: true },
      });
      for (const vu of vendorUsers) {
        await this.notify.emit(tx, {
          type: NotificationType.PO_SENT,
          userId: vu.id,
          title: `PO sent: ${po.number}`,
          message: 'Purchase order has been sent.',
          entityType: 'PURCHASE_ORDER',
          entityId: po.id,
        });
      }
      return u;
    });
    return updated;
  }

  async markDelivered(
    id: string,
    note: string | undefined,
    user: AuthPrincipal,
    ctx: { ipAddress?: string; userAgent?: string; requestId?: string },
  ) {
    const po = await this.findById(id);
    await this.assertAccess(po, user);
    if (po.status !== PoStatus.SENT) {
      throw invalidTransition('Only SENT POs can be marked delivered', { from: po.status });
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const u = await tx.purchaseOrder.update({
        where: { id: po.id },
        data: { status: PoStatus.DELIVERED, deliveredAt: new Date() },
      });
      await tx.poStatusEvent.create({
        data: {
          purchaseOrderId: po.id,
          fromStatus: PoStatus.SENT,
          toStatus: PoStatus.DELIVERED,
          note,
          actorId: user.sub,
        },
      });
      await this.audit.log(tx, {
        action: AuditAction.PO_DELIVERED,
        entityType: AuditEntityType.PURCHASE_ORDER,
        entityId: po.id,
        description: `PO delivered: ${po.number}`,
        metadata: { note: note ?? null },
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

  async renderPdf(id: string, user: AuthPrincipal, ctx: { ipAddress?: string; userAgent?: string; requestId?: string }): Promise<Buffer> {
    const po = await this.findById(id);
    await this.assertAccess(po, user);
    await this.audit.log(this.prisma, {
      action: AuditAction.INVOICE_PRINTED, // generic print/email event; reuse code
      entityType: AuditEntityType.PURCHASE_ORDER,
      entityId: po.id,
      description: `PO PDF rendered: ${po.number}`,
      actorId: user.sub,
      actorEmail: user.email,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      requestId: ctx.requestId,
    });
    return this.pdf.renderPurchaseOrder(po);
  }
}
