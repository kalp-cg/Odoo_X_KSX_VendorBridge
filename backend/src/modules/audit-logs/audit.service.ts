import { Injectable, Logger } from '@nestjs/common';
import type { Prisma, AuditAction, AuditEntityType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface AuditLogInput {
  action: AuditAction;
  entityType: AuditEntityType;
  entityId?: string | null;
  description?: string;
  metadata?: Record<string, unknown> | null;
  actorId?: string | null;
  actorEmail?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
}

export interface AuditQuery {
  entityType?: AuditEntityType;
  entityId?: string;
  action?: AuditAction;
  actorId?: string;
  from?: Date;
  to?: Date;
  page?: number;
  pageSize?: number;
}

/**
 * The ONLY supported way to write to audit_logs.
 *
 * Always called from inside a Prisma transaction (`tx`) so that the audit
 * record and the business change are committed atomically. The application
 * role does not have UPDATE/DELETE on audit_logs, and a DB trigger rejects
 * any modification attempt.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Write an audit record. Pass the transaction client when inside a business tx. */
  async log(tx: Prisma.TransactionClient | PrismaService, input: AuditLogInput): Promise<void> {
    const client: any = (tx as any).auditLog ? tx : this.prisma;
    try {
      await client.auditLog.create({
        data: {
          action: input.action,
          entityType: input.entityType,
          entityId: input.entityId ?? null,
          description: input.description ?? null,
          metadata: input.metadata ? (input.metadata as any) : undefined,
          actorId: input.actorId ?? null,
          actorEmail: input.actorEmail ?? null,
          ipAddress: input.ipAddress ?? null,
          userAgent: input.userAgent ?? null,
          requestId: input.requestId ?? null,
        },
      });
    } catch (err) {
      // Audit failures must NEVER block the parent business operation.
      this.logger.error(
        `Audit log write failed: action=${input.action} entity=${input.entityType}/${input.entityId ?? '-'} err=${(err as Error).message}`,
      );
    }
  }

  /** Read-only query for the audit endpoint. */
  async query(filters: AuditQuery) {
    const page = Math.max(1, Math.floor(filters.page ?? 1));
    const pageSize = Math.min(100, Math.max(1, Math.floor(filters.pageSize ?? 20)));
    const where: Prisma.AuditLogWhereInput = {};
    if (filters.entityType) where.entityType = filters.entityType;
    if (filters.entityId) where.entityId = filters.entityId;
    if (filters.action) where.action = filters.action;
    if (filters.actorId) where.actorId = filters.actorId;
    if (filters.from || filters.to) {
      where.occurredAt = {
        ...(filters.from ? { gte: filters.from } : {}),
        ...(filters.to ? { lte: filters.to } : {}),
      };
    }

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: { occurredAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { actor: { select: { id: true, email: true, fullName: true, role: true } } },
      }),
    ]);

    return { rows, total, page, pageSize };
  }

  /** Stream a CSV export. Caller must pipe to a writable. */
  async exportCsv(filters: AuditQuery): Promise<string> {
    const where: Prisma.AuditLogWhereInput = {};
    if (filters.entityType) where.entityType = filters.entityType;
    if (filters.entityId) where.entityId = filters.entityId;
    if (filters.action) where.action = filters.action;
    if (filters.actorId) where.actorId = filters.actorId;
    if (filters.from || filters.to) {
      where.occurredAt = {
        ...(filters.from ? { gte: filters.from } : {}),
        ...(filters.to ? { lte: filters.to } : {}),
      };
    }
    const rows = await this.prisma.auditLog.findMany({
      where,
      orderBy: { occurredAt: 'desc' },
      take: 100_000, // hard cap to protect memory
      include: { actor: { select: { email: true } } },
    });
    const header = ['id', 'occurredAt', 'action', 'entityType', 'entityId', 'actorEmail', 'ipAddress', 'description', 'metadata'];
    const lines: string[] = [header.join(',')];
    for (const r of rows) {
      lines.push(
        [
          r.id,
          r.occurredAt.toISOString(),
          r.action,
          r.entityType,
          r.entityId ?? '',
          r.actor?.email ?? r.actorEmail ?? '',
          r.ipAddress ?? '',
          csvCell(r.description),
          csvCell(r.metadata ? JSON.stringify(r.metadata) : ''),
        ].join(','),
      );
    }
    // UTF-8 BOM for Excel
    return '\uFEFF' + lines.join('\n');
  }
}

function csvCell(v: string | null | undefined): string {
  if (v == null) return '';
  if (v.includes(',') || v.includes('"') || v.includes('\n')) {
    return '"' + v.replace(/"/g, '""') + '"';
  }
  return v;
}
