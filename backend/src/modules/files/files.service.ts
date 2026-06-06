import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CloudinaryService } from './cloudinary.service';
import { AuditService } from '../audit-logs/audit.service';
import { forbidden, notFound, normalizePage, buildPage, ownershipDenied, type Page } from '../../common';
import { AuditAction, AuditEntityType, FileOwnerType, UserRole } from '@prisma/client';
import type { InitUploadDto, ListFilesQueryDto } from './files.dto';
import type { AuthPrincipal } from '../../common';

@Injectable()
export class FilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloud: CloudinaryService,
    private readonly audit: AuditService,
  ) {}

  async upload(
    dto: InitUploadDto,
    buffer: Buffer,
    user: AuthPrincipal,
    requestContext: { ipAddress?: string; userAgent?: string; requestId?: string },
  ) {
    this.cloud.validateSize(buffer.length);
    this.cloud.validateMime(dto.mimeType);

    await this.assertOwnerAccess(user, dto.ownerType, dto.ownerId);

    const folder = `vendorbridge/${dto.ownerType.toLowerCase()}${dto.ownerId ? '/' + dto.ownerId : ''}`;
    const res = await this.cloud.uploadBuffer(buffer, dto.filename, dto.mimeType, folder);
    const checksum = this.cloud.checksum(buffer);

    const ownerFk = this.pickOwnerFk(dto.ownerType, dto.ownerId);

    const file = await this.prisma.fileAsset.create({
      data: {
        ownerType: dto.ownerType,
        ownerId: dto.ownerId ?? null,
        uploaderId: user.sub,
        visibility: dto.visibility,
        publicId: res.public_id,
        url: res.url,
        secureUrl: res.secure_url,
        format: res.format ?? '',
        bytes: res.bytes ?? buffer.length,
        originalName: dto.filename,
        mimeType: dto.mimeType,
        width: res.width ?? null,
        height: res.height ?? null,
        checksum,
        ...ownerFk,
      },
    });

    await this.audit.log(this.prisma, {
      action: AuditAction.FILE_UPLOADED,
      entityType: AuditEntityType.FILE,
      entityId: file.id,
      description: `File uploaded: ${dto.filename} (${dto.mimeType}, ${buffer.length} bytes)`,
      actorId: user.sub,
      actorEmail: user.email,
      ipAddress: requestContext.ipAddress,
      userAgent: requestContext.userAgent,
      requestId: requestContext.requestId,
    });

    return file;
  }

  async list(q: ListFilesQueryDto, user: AuthPrincipal): Promise<Page<unknown>> {
    const { page, pageSize, skip, take } = normalizePage(q);
    const where: any = { deletedAt: null };
    if (q.ownerType) where.ownerType = q.ownerType;
    if (q.ownerId) where.ownerId = q.ownerId;
    if (user.role === UserRole.VENDOR) {
      // Scope to files of this vendor's company or uploaded by them
      where.OR = [
        { uploaderId: user.sub },
        ...(user.vendorCompanyId ? [{ vendorId: user.vendorCompanyId }] : []),
      ];
    }
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.fileAsset.findMany({ where, orderBy: { uploadedAt: 'desc' }, skip, take }),
      this.prisma.fileAsset.count({ where }),
    ]);
    return buildPage(rows, total, page, pageSize);
  }

  async findById(id: string, user: AuthPrincipal) {
    const f = await this.prisma.fileAsset.findUnique({ where: { id } });
    if (!f || f.deletedAt) throw notFound('File not found');
    this.assertReadAccess(f, user);
    return f;
  }

  async softDelete(id: string, user: AuthPrincipal, ctx: { ipAddress?: string; userAgent?: string; requestId?: string }) {
    const f = await this.findById(id, user);
    if (f.uploaderId !== user.sub && user.role !== UserRole.ADMIN) {
      throw forbidden('Only the uploader or an admin may delete this file');
    }
    const updated = await this.prisma.fileAsset.update({
      where: { id: f.id },
      data: { deletedAt: new Date() },
    });
    // Best-effort Cloudinary cleanup. Do not fail the request if it errors.
    this.cloud.destroy(f.publicId, f.mimeType.startsWith('image/') ? 'image' : 'raw').catch(() => undefined);
    await this.audit.log(this.prisma, {
      action: AuditAction.FILE_DELETED,
      entityType: AuditEntityType.FILE,
      entityId: f.id,
      description: `File deleted: ${f.originalName}`,
      actorId: user.sub,
      actorEmail: user.email,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      requestId: ctx.requestId,
    });
    return updated;
  }

  // ---- helpers ----
  private pickOwnerFk(ownerType: FileOwnerType, ownerId: string | undefined) {
    switch (ownerType) {
      case FileOwnerType.USER: return { userId: ownerId };
      case FileOwnerType.VENDOR: return { vendorId: ownerId };
      case FileOwnerType.RFQ: return { rfqId: ownerId };
      case FileOwnerType.QUOTATION: return { quotationId: ownerId };
      case FileOwnerType.PURCHASE_ORDER: return { purchaseOrderId: ownerId };
      case FileOwnerType.INVOICE: return { invoiceId: ownerId };
      case FileOwnerType.APPROVAL: return {};
      default: return {};
    }
  }

  private async assertOwnerAccess(user: AuthPrincipal, ownerType: FileOwnerType, ownerId?: string) {
    if (user.role === UserRole.ADMIN || user.role === UserRole.OFFICER || user.role === UserRole.MANAGER) {
      return;
    }
    // Vendors can only upload to their own vendor company or to their user profile
    if (user.role === UserRole.VENDOR) {
      if (ownerType === FileOwnerType.VENDOR && ownerId && ownerId !== user.vendorCompanyId) {
        throw ownershipDenied('You can only upload to your own vendor company');
      }
      if (ownerType === FileOwnerType.USER && ownerId && ownerId !== user.sub) {
        throw ownershipDenied('You can only upload to your own user profile');
      }
      return;
    }
    throw forbidden('You do not have permission to upload files');
  }

  private assertReadAccess(
    f: { uploaderId: string; vendorId: string | null; ownerType: FileOwnerType; ownerId: string | null },
    user: AuthPrincipal,
  ): void {
    if (user.role === UserRole.ADMIN || user.role === UserRole.OFFICER || user.role === UserRole.MANAGER) return;
    if (user.role === UserRole.VENDOR) {
      if (f.uploaderId === user.sub) return;
      if (f.vendorId && f.vendorId === user.vendorCompanyId) return;
      throw ownershipDenied('You do not have access to this file');
    }
    throw forbidden('Forbidden');
  }
}
