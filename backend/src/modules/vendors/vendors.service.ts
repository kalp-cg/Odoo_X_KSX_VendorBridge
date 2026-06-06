import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit-logs/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { businessRule, conflict, notFound, normalizePage, buildPage, type Page } from '../../common';
import { AuditAction, AuditEntityType, NotificationType, VendorStatus } from '@prisma/client';
import type {
  CreateVendorDto,
  UpdateVendorDto,
  ChangeVendorStatusDto,
  ListVendorsQueryDto,
} from './vendors.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class VendorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notify: NotificationsService,
  ) {}

  async create(
    dto: CreateVendorDto,
    actor: { id: string; email: string; ipAddress?: string; userAgent?: string; requestId?: string },
  ) {
    if (dto.gstNumber) {
      const exists = await this.prisma.vendorCompany.findUnique({ where: { gstNumber: dto.gstNumber } });
      if (exists) throw conflict('A vendor with this GST number already exists');
    }
    const vendor = await this.prisma.vendorCompany.create({
      data: {
        legalName: dto.legalName,
        displayName: dto.displayName,
        gstNumber: dto.gstNumber,
        panNumber: dto.panNumber,
        registrationNo: dto.registrationNo,
        contactEmail: dto.contactEmail,
        contactPhone: dto.contactPhone,
        addressLine1: dto.addressLine1,
        addressLine2: dto.addressLine2,
        city: dto.city,
        state: dto.state,
        postalCode: dto.postalCode,
        country: dto.country,
        category: dto.category,
        notes: dto.notes,
        status: VendorStatus.PENDING_VERIFICATION,
        createdById: actor.id,
      },
    });
    await this.audit.log(this.prisma, {
      action: AuditAction.VENDOR_CREATED,
      entityType: AuditEntityType.VENDOR,
      entityId: vendor.id,
      description: `Vendor created: ${vendor.displayName}`,
      actorId: actor.id,
      actorEmail: actor.email,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
      requestId: actor.requestId,
    });
    return vendor;
  }

  async list(q: ListVendorsQueryDto, scope?: { vendorCompanyId?: string }): Promise<Page<unknown>> {
    const { page, pageSize, skip, take } = normalizePage(q);
    const where: Prisma.VendorCompanyWhereInput = {};
    if (q.status) where.status = q.status;
    if (q.category) where.category = q.category;
    if (q.search) {
      where.OR = [
        { legalName: { contains: q.search, mode: 'insensitive' } },
        { displayName: { contains: q.search, mode: 'insensitive' } },
        { gstNumber: { contains: q.search, mode: 'insensitive' } },
        { contactEmail: { contains: q.search, mode: 'insensitive' } },
      ];
    }
    if (scope?.vendorCompanyId) where.id = scope.vendorCompanyId;
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.vendorCompany.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.vendorCompany.count({ where }),
    ]);
    return buildPage(rows, total, page, pageSize);
  }

  async findById(id: string) {
    const v = await this.prisma.vendorCompany.findUnique({
      where: { id },
      include: { users: { select: { id: true, email: true, fullName: true, status: true } } },
    });
    if (!v) throw notFound('Vendor not found');
    return v;
  }

  async update(
    id: string,
    dto: UpdateVendorDto,
    actor: { id: string; email: string; ipAddress?: string; userAgent?: string; requestId?: string },
  ) {
    const vendor = await this.findById(id);
    const updated = await this.prisma.vendorCompany.update({ where: { id: vendor.id }, data: dto });
    await this.audit.log(this.prisma, {
      action: AuditAction.VENDOR_UPDATED,
      entityType: AuditEntityType.VENDOR,
      entityId: vendor.id,
      description: `Vendor updated: ${vendor.displayName}`,
      actorId: actor.id,
      actorEmail: actor.email,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
      requestId: actor.requestId,
    });
    return updated;
  }

  async changeStatus(
    id: string,
    dto: ChangeVendorStatusDto,
    actor: { id: string; email: string; ipAddress?: string; userAgent?: string; requestId?: string },
  ) {
    const vendor = await this.findById(id);

    // Lifecycle guard
    const allowed = this.allowedTransitions(vendor.status);
    if (!allowed.includes(dto.status)) {
      throw businessRule(
        `Invalid status transition for vendor: ${vendor.status} -> ${dto.status}`,
        { from: vendor.status, to: dto.status, allowed },
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.vendorCompany.update({
        where: { id: vendor.id },
        data: { status: dto.status },
      });
      await this.audit.log(tx, {
        action: AuditAction.VENDOR_STATUS_CHANGED,
        entityType: AuditEntityType.VENDOR,
        entityId: vendor.id,
        description: `Vendor status: ${vendor.displayName} ${vendor.status} -> ${dto.status}`,
        metadata: { from: vendor.status, to: dto.status, reason: dto.reason ?? null },
        actorId: actor.id,
        actorEmail: actor.email,
        ipAddress: actor.ipAddress,
        userAgent: actor.userAgent,
        requestId: actor.requestId,
      });
      // Notify all users of this vendor
      const users = await tx.user.findMany({ where: { vendorCompanyId: vendor.id }, select: { id: true } });
      for (const u of users) {
        await this.notify.emit(tx, {
          type: NotificationType.VENDOR_STATUS_CHANGED,
          userId: u.id,
          title: `Your company status is now ${dto.status}`,
          message: `${vendor.displayName} is now ${dto.status.replace(/_/g, ' ').toLowerCase()}.`,
          entityType: 'VENDOR',
          entityId: vendor.id,
          metadata: { from: vendor.status, to: dto.status },
        });
      }
      return updated;
    });

    return result;
  }

  private allowedTransitions(from: VendorStatus): VendorStatus[] {
    switch (from) {
      case VendorStatus.PENDING_VERIFICATION:
        return [VendorStatus.ACTIVE, VendorStatus.INACTIVE, VendorStatus.BLOCKED];
      case VendorStatus.ACTIVE:
        return [VendorStatus.INACTIVE, VendorStatus.BLOCKED];
      case VendorStatus.INACTIVE:
        return [VendorStatus.ACTIVE, VendorStatus.BLOCKED];
      case VendorStatus.BLOCKED:
        return [VendorStatus.ACTIVE, VendorStatus.INACTIVE];
      default:
        return [];
    }
  }
}
