import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit-logs/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PdfService } from '../../common/utils/pdf.service';
import { EmailService } from '../../common/utils/email.service';
import {
  businessRule,
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
  InvoiceStatus,
  NotificationType,
  Prisma,
  UserRole,
} from '@prisma/client';
import type { ListInvoicesQueryDto, MarkPaidDto } from './invoices.dto';
import type { AuthPrincipal } from '../../common';

@Injectable()
export class InvoicesService {
  private readonly logger = new Logger(InvoicesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notify: NotificationsService,
    private readonly pdf: PdfService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
  ) {}

  async list(q: ListInvoicesQueryDto, user: AuthPrincipal): Promise<Page<unknown>> {
    const { page, pageSize, skip, take } = normalizePage(q);
    const where: Prisma.InvoiceWhereInput = {};
    if (q.status) where.status = q.status;
    if (q.vendorId) where.vendorId = q.vendorId;
    if (user.role === UserRole.VENDOR) where.vendorId = user.vendorCompanyId ?? '__none__';
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.invoice.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: {
          vendor: { select: { id: true, displayName: true } },
          purchaseOrder: { select: { id: true, number: true } },
        },
      }),
      this.prisma.invoice.count({ where }),
    ]);
    return buildPage(rows, total, page, pageSize);
  }

  async findById(id: string) {
    const inv = await this.prisma.invoice.findUnique({
      where: { id },
      include: {
        vendor: true,
        lineItems: { orderBy: { lineNo: 'asc' } },
        purchaseOrder: { select: { id: true, number: true } },
        approval: { select: { id: true } },
        payments: { orderBy: { paidAt: 'desc' } },
        statusEvents: { orderBy: { occurredAt: 'asc' }, include: { actor: { select: { id: true, fullName: true, email: true } } } },
      },
    });
    if (!inv) throw notFound('Invoice not found');
    return inv;
  }

  async assertAccess(inv: { vendorId: string }, user: AuthPrincipal): Promise<void> {
    if (user.role === UserRole.VENDOR && inv.vendorId !== user.vendorCompanyId) {
      throw ownershipDenied('You can only access your own invoices');
    }
  }

  async markPaid(
    id: string,
    dto: MarkPaidDto,
    user: AuthPrincipal,
    ctx: { ipAddress?: string; userAgent?: string; requestId?: string },
  ) {
    const inv = await this.findById(id);
    await this.assertAccess(inv, user);
    if (inv.status === InvoiceStatus.PAID) throw invalidTransition('Invoice is already paid');
    const updated = await this.prisma.$transaction(async (tx) => {
      const u = await tx.invoice.update({
        where: { id: inv.id },
        data: { status: InvoiceStatus.PAID, paidAt: new Date() },
      });
      await tx.invoiceStatusEvent.create({
        data: {
          invoiceId: inv.id,
          fromStatus: inv.status,
          toStatus: InvoiceStatus.PAID,
          note: `${dto.payment.method} ${dto.payment.amount}`,
          actorId: user.sub,
        },
      });
      await tx.payment.create({
        data: {
          invoiceId: inv.id,
          amount: dto.payment.amount,
          method: dto.payment.method,
          reference: dto.payment.reference,
          notes: dto.payment.notes,
          recordedById: user.sub,
        },
      });
      await this.audit.log(tx, {
        action: AuditAction.INVOICE_PAID,
        entityType: AuditEntityType.INVOICE,
        entityId: inv.id,
        description: `Invoice paid: ${inv.number}`,
        metadata: { amount: dto.payment.amount, method: dto.payment.method, reference: dto.payment.reference ?? null },
        actorId: user.sub,
        actorEmail: user.email,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        requestId: ctx.requestId,
      });
      const vendorUsers = await tx.user.findMany({
        where: { vendorCompanyId: inv.vendorId },
        select: { id: true },
      });
      for (const vu of vendorUsers) {
        await this.notify.emit(tx, {
          type: NotificationType.INVOICE_PAID,
          userId: vu.id,
          title: `Invoice paid: ${inv.number}`,
          message: 'Your invoice has been marked as paid.',
          entityType: 'INVOICE',
          entityId: inv.id,
        });
      }
      return u;
    });
    return updated;
  }

  async renderPdf(id: string, user: AuthPrincipal, ctx: { ipAddress?: string; userAgent?: string; requestId?: string }): Promise<Buffer> {
    const inv = await this.findById(id);
    await this.assertAccess(inv, user);
    await this.audit.log(this.prisma, {
      action: AuditAction.INVOICE_PRINTED,
      entityType: AuditEntityType.INVOICE,
      entityId: inv.id,
      description: `Invoice PDF rendered: ${inv.number}`,
      actorId: user.sub,
      actorEmail: user.email,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      requestId: ctx.requestId,
    });
    return this.pdf.renderInvoice(inv);
  }

  async emailInvoice(id: string, user: AuthPrincipal, ctx: { ipAddress?: string; userAgent?: string; requestId?: string }) {
    const inv = await this.findById(id);
    await this.assertAccess(inv, user);
    const pdf = await this.pdf.renderInvoice(inv);
    const to = inv.vendor.contactEmail;
    await this.email.send({
      to,
      subject: `Invoice ${inv.number} from VendorBridge`,
      text: `Please find attached invoice ${inv.number} for ${inv.grandTotal} ${inv.currency}.`,
      attachments: [{ filename: `${inv.number}.pdf`, content: pdf }],
    });
    await this.audit.log(this.prisma, {
      action: AuditAction.INVOICE_EMAILED,
      entityType: AuditEntityType.INVOICE,
      entityId: inv.id,
      description: `Invoice emailed: ${inv.number} -> ${to}`,
      actorId: user.sub,
      actorEmail: user.email,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      requestId: ctx.requestId,
    });
    return { ok: true, sentTo: to };
  }

  /**
   * Daily cron: mark PENDING invoices whose due date is in the past as OVERDUE.
   */
  @Cron(CronExpression.EVERY_DAY_AT_9AM, { name: 'invoices-overdue-sweep' })
  async sweepOverdue(): Promise<{ updated: number }> {
    const now = new Date();
    const overdueDays = this.config.get<number>('INVOICE_OVERDUE_AFTER_DAYS') ?? 30;
    const threshold = new Date(now);
    threshold.setUTCDate(threshold.getUTCDate() - overdueDays);

    const candidates = await this.prisma.invoice.findMany({
      where: { status: InvoiceStatus.PENDING, dueDate: { lt: now } },
      select: { id: true, number: true, status: true },
    });
    if (candidates.length === 0) return { updated: 0 };

    let updated = 0;
    for (const c of candidates) {
      try {
        await this.prisma.$transaction(async (tx) => {
          const u = await tx.invoice.update({
            where: { id: c.id },
            data: { status: InvoiceStatus.OVERDUE, overdueAt: now },
          });
          await tx.invoiceStatusEvent.create({
            data: {
              invoiceId: c.id,
              fromStatus: c.status,
              toStatus: InvoiceStatus.OVERDUE,
              note: `Auto-marked overdue (${overdueDays} days past due)`,
              actorId: u.id, // system; audit still recorded
            },
          });
          await this.audit.log(tx, {
            action: AuditAction.INVOICE_OVERDUE,
            entityType: AuditEntityType.INVOICE,
            entityId: c.id,
            description: `Invoice overdue: ${c.number}`,
            metadata: { overdueAfterDays: overdueDays },
            actorId: null,
            actorEmail: 'system@vendorsbridge',
          });
          const vendorUsers = await tx.user.findMany({
            where: { vendorCompanyId: u.vendorId },
            select: { id: true },
          });
          for (const vu of vendorUsers) {
            await this.notify.emit(tx, {
              type: NotificationType.INVOICE_OVERDUE,
              userId: vu.id,
              title: `Invoice overdue: ${u.number}`,
              message: `Invoice ${u.number} is now overdue.`,
              entityType: 'INVOICE',
              entityId: u.id,
            });
          }
        });
        updated++;
      } catch (err) {
        this.logger.error(`Overdue sweep failed for invoice ${c.id}: ${(err as Error).message}`);
      }
    }
    if (updated > 0) this.logger.log(`Overdue sweep: marked ${updated} invoices as OVERDUE`);
    return { updated };
  }
}
