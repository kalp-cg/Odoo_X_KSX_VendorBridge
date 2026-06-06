import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit-logs/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NumberingService } from '../../common/utils/numbering.service';
import {
  businessRule,
  conflict,
  invalidTransition,
  notFound,
  normalizePage,
  buildPage,
  ownershipDenied,
  type Page,
} from '../../common';
import { AuditAction, AuditEntityType, NotificationType, Prisma, RfqStatus, RfqVendorStatus, UserRole, VendorStatus } from '@prisma/client';
import type { CreateRfqDto, ListRfqQueryDto, UpdateRfqDto } from './rfq.dto';
import type { AuthPrincipal } from '../../common';

@Injectable()
export class RfqService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notify: NotificationsService,
    private readonly numbering: NumberingService,
  ) {}

  async create(
    dto: CreateRfqDto,
    user: AuthPrincipal,
    ctx: { ipAddress?: string; userAgent?: string; requestId?: string },
  ) {
    // Verify all vendors are ACTIVE
    const vendors = await this.prisma.vendorCompany.findMany({
      where: { id: { in: dto.vendorIds } },
    });
    if (vendors.length !== dto.vendorIds.length) {
      throw notFound('One or more vendorIds not found');
    }
    const inactive = vendors.filter((v) => v.status !== VendorStatus.ACTIVE);
    if (inactive.length > 0) {
      throw businessRule('All invited vendors must be ACTIVE', { inactiveIds: inactive.map((v) => v.id) });
    }

    const number = await this.numbering.next('RFQ');

    const rfq = await this.prisma.$transaction(async (tx) => {
      const r = await tx.rfq.create({
        data: {
          number,
          title: dto.title,
          description: dto.description,
          status: RfqStatus.DRAFT,
          deadline: dto.deadline,
          createdById: user.sub,
          lineItems: {
            create: dto.lineItems.map((li, idx) => ({
              lineNo: li.lineNo ?? idx + 1,
              description: li.description,
              quantity: new Prisma.Decimal(li.quantity),
              unit: li.unit,
              targetUnitPrice: li.targetUnitPrice != null ? new Prisma.Decimal(li.targetUnitPrice) : null,
              notes: li.notes,
              createdById: user.sub,
            })),
          },
          vendors: {
            create: dto.vendorIds.map((vid) => ({
              vendorId: vid,
              status: RfqVendorStatus.INVITED,
            })),
          },
        },
        include: { lineItems: true, vendors: { include: { vendor: true } } },
      });
      await this.audit.log(tx, {
        action: AuditAction.RFQ_CREATED,
        entityType: AuditEntityType.RFQ,
        entityId: r.id,
        description: `RFQ created: ${r.number} — ${r.title}`,
        metadata: { number: r.number, vendorCount: dto.vendorIds.length, lineItemCount: dto.lineItems.length },
        actorId: user.sub,
        actorEmail: user.email,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        requestId: ctx.requestId,
      });
      return r;
    });
    return rfq;
  }

  async update(
    id: string,
    dto: UpdateRfqDto,
    user: AuthPrincipal,
    ctx: { ipAddress?: string; userAgent?: string; requestId?: string },
  ) {
    const rfq = await this.findById(id);
    if (rfq.status !== RfqStatus.DRAFT) {
      throw invalidTransition('Only DRAFT RFQs can be edited', { from: rfq.status });
    }
    if (rfq.createdById !== user.sub && user.role !== UserRole.ADMIN) {
      throw ownershipDenied('Only the creator or an admin may edit this RFQ');
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const r = await tx.rfq.update({
        where: { id: rfq.id },
        data: {
          title: dto.title ?? rfq.title,
          description: dto.description ?? rfq.description,
          deadline: dto.deadline ?? rfq.deadline,
        },
      });
      if (dto.lineItems) {
        await tx.rfqLineItem.deleteMany({ where: { rfqId: rfq.id } });
        await tx.rfqLineItem.createMany({
          data: dto.lineItems.map((li, idx) => ({
            rfqId: rfq.id,
            lineNo: li.lineNo ?? idx + 1,
            description: li.description,
            quantity: new Prisma.Decimal(li.quantity),
            unit: li.unit,
            targetUnitPrice: li.targetUnitPrice != null ? new Prisma.Decimal(li.targetUnitPrice) : null,
            notes: li.notes,
            createdById: user.sub,
          })),
        });
      }
      if (dto.vendorIds) {
        await tx.rfqVendor.deleteMany({ where: { rfqId: rfq.id } });
        await tx.rfqVendor.createMany({
          data: dto.vendorIds.map((vid) => ({ rfqId: rfq.id, vendorId: vid, status: RfqVendorStatus.INVITED })),
        });
      }
      await this.audit.log(tx, {
        action: AuditAction.RFQ_UPDATED,
        entityType: AuditEntityType.RFQ,
        entityId: r.id,
        description: `RFQ updated: ${rfq.number}`,
        actorId: user.sub,
        actorEmail: user.email,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        requestId: ctx.requestId,
      });
      return r;
    });
    return updated;
  }

  async findById(id: string) {
    const r = await this.prisma.rfq.findUnique({
      where: { id },
      include: {
        lineItems: { orderBy: { lineNo: 'asc' } },
        vendors: { include: { vendor: true } },
        createdBy: { select: { id: true, fullName: true, email: true } },
        files: { where: { deletedAt: null } },
      },
    });
    if (!r) throw notFound('RFQ not found');
    return r;
  }

  async list(q: ListRfqQueryDto, user: AuthPrincipal): Promise<Page<unknown>> {
    const { page, pageSize, skip, take } = normalizePage(q);
    const where: Prisma.RfqWhereInput = {};
    if (q.status) where.status = q.status;
    if (q.search) {
      where.OR = [
        { number: { contains: q.search, mode: 'insensitive' } },
        { title: { contains: q.search, mode: 'insensitive' } },
      ];
    }
    if (user.role === UserRole.VENDOR) {
      where.vendors = { some: { vendorId: user.vendorCompanyId ?? '__none__' } };
      if (q.scope === 'invited') {
        where.status = { in: [RfqStatus.PUBLISHED] };
      }
    }
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.rfq.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: {
          _count: { select: { vendors: true, quotations: true, lineItems: true } },
        },
      }),
      this.prisma.rfq.count({ where }),
    ]);
    return buildPage(rows, total, page, pageSize);
  }

  // ============================================================
  // Workflow transitions
  // ============================================================
  async publish(id: string, user: AuthPrincipal, ctx: { ipAddress?: string; userAgent?: string; requestId?: string }) {
    const rfq = await this.findById(id);
    if (rfq.status !== RfqStatus.DRAFT) {
      throw invalidTransition('Only DRAFT RFQs can be published', { from: rfq.status });
    }
    if (rfq.deadline <= new Date()) {
      throw businessRule('Cannot publish an RFQ whose deadline has already passed');
    }
    if (rfq.vendors.length === 0) throw businessRule('RFQ must have at least one invited vendor');

    const result = await this.prisma.$transaction(async (tx) => {
      const r = await tx.rfq.update({
        where: { id: rfq.id },
        data: { status: RfqStatus.PUBLISHED, publishedAt: new Date() },
      });
      await this.audit.log(tx, {
        action: AuditAction.RFQ_PUBLISHED,
        entityType: AuditEntityType.RFQ,
        entityId: r.id,
        description: `RFQ published: ${r.number}`,
        actorId: user.sub,
        actorEmail: user.email,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        requestId: ctx.requestId,
      });
      // Notify all users of invited vendor companies
      const vendorIds = rfq.vendors.map((v) => v.vendorId);
      const vendorUsers = await tx.user.findMany({
        where: { vendorCompanyId: { in: vendorIds } },
        select: { id: true },
      });
      for (const vu of vendorUsers) {
        await this.notify.emit(tx, {
          type: NotificationType.RFQ_PUBLISHED,
          userId: vu.id,
          title: `New RFQ: ${r.number}`,
          message: `${r.title} — deadline ${r.deadline.toISOString()}`,
          entityType: 'RFQ',
          entityId: r.id,
          metadata: { number: r.number, deadline: r.deadline.toISOString() },
        });
      }
      return r;
    });
    return result;
  }

  async close(id: string, user: AuthPrincipal, ctx: { ipAddress?: string; userAgent?: string; requestId?: string }) {
    const rfq = await this.findById(id);
    if (rfq.status !== RfqStatus.PUBLISHED && rfq.status !== RfqStatus.DRAFT) {
      throw invalidTransition('Only DRAFT or PUBLISHED RFQs can be closed', { from: rfq.status });
    }
    const result = await this.prisma.$transaction(async (tx) => {
      const r = await tx.rfq.update({
        where: { id: rfq.id },
        data: { status: RfqStatus.CLOSED, closedAt: new Date() },
      });
      await this.audit.log(tx, {
        action: AuditAction.RFQ_CLOSED,
        entityType: AuditEntityType.RFQ,
        entityId: r.id,
        description: `RFQ closed: ${r.number}`,
        actorId: user.sub,
        actorEmail: user.email,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        requestId: ctx.requestId,
      });
      return r;
    });
    return result;
  }

  async cancel(id: string, reason: string, user: AuthPrincipal, ctx: { ipAddress?: string; userAgent?: string; requestId?: string }) {
    const rfq = await this.findById(id);
    if (rfq.status === RfqStatus.CANCELLED || rfq.status === RfqStatus.CLOSED) {
      throw invalidTransition('RFQ is already in a terminal state', { from: rfq.status });
    }
    const result = await this.prisma.$transaction(async (tx) => {
      const r = await tx.rfq.update({
        where: { id: rfq.id },
        data: { status: RfqStatus.CANCELLED, cancelledAt: new Date(), cancelReason: reason },
      });
      await this.audit.log(tx, {
        action: AuditAction.RFQ_CANCELLED,
        entityType: AuditEntityType.RFQ,
        entityId: r.id,
        description: `RFQ cancelled: ${r.number} — ${reason}`,
        metadata: { reason },
        actorId: user.sub,
        actorEmail: user.email,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        requestId: ctx.requestId,
      });
      // Notify invited vendors
      const vendorUsers = await tx.user.findMany({
        where: { vendorCompanyId: { in: rfq.vendors.map((v) => v.vendorId) } },
        select: { id: true },
      });
      for (const vu of vendorUsers) {
        await this.notify.emit(tx, {
          type: NotificationType.RFQ_CANCELLED,
          userId: vu.id,
          title: `RFQ cancelled: ${r.number}`,
          message: `${r.title} — ${reason}`,
          entityType: 'RFQ',
          entityId: r.id,
        });
      }
      return r;
    });
    return result;
  }
}
