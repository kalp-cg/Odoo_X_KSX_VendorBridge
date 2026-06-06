import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { forbidden, normalizePage, buildPage, type Page } from '../../common';
import { InvoiceStatus, Prisma, UserRole } from '@prisma/client';
import type { ReportQueryDto } from './reports.dto';
import type { AuthPrincipal } from '../../common';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  // ============================================================
  // Dashboard — single round-trip aggregates
  // ============================================================
  async dashboard(user: AuthPrincipal) {
    const vendorScope = user.role === UserRole.VENDOR ? user.vendorCompanyId ?? '__none__' : null;

    const basePoWhere: Prisma.PurchaseOrderWhereInput = vendorScope ? { vendorId: vendorScope } : {};
    const baseInvWhere: Prisma.InvoiceWhereInput = vendorScope ? { vendorId: vendorScope } : {};
    const baseRfqWhere: Prisma.RfqWhereInput =
      vendorScope ? { vendors: { some: { vendorId: vendorScope } } } : {};

    const [openRfq, openPo, pendingInvoices, overdueInvoices, vendorCount, recentPos, recentInvoices, mtdSpend] =
      await this.prisma.$transaction([
        this.prisma.rfq.count({ where: { ...baseRfqWhere, status: 'PUBLISHED' } }),
        this.prisma.purchaseOrder.count({ where: { ...basePoWhere, status: { in: ['GENERATED', 'SENT'] } } }),
        this.prisma.invoice.count({ where: { ...baseInvWhere, status: InvoiceStatus.PENDING } }),
        this.prisma.invoice.count({ where: { ...baseInvWhere, status: InvoiceStatus.OVERDUE } }),
        vendorScope
          ? this.prisma.vendorCompany.count({ where: { id: vendorScope } })
          : this.prisma.vendorCompany.count(),
        this.prisma.purchaseOrder.findMany({
          where: basePoWhere,
          orderBy: { generatedAt: 'desc' },
          take: 5,
          include: { vendor: { select: { id: true, displayName: true } } },
        }),
        this.prisma.invoice.findMany({
          where: baseInvWhere,
          orderBy: { createdAt: 'desc' },
          take: 5,
          include: { vendor: { select: { id: true, displayName: true } }, purchaseOrder: { select: { id: true, number: true } } },
        }),
        vendorScope
          ? this.prisma.$queryRaw<{ total: { toString(): string } | string | null }[]>`
              SELECT COALESCE(SUM("grandTotal"), 0) AS total
              FROM invoices
              WHERE "createdAt" >= date_trunc('month', now())
                AND "vendorId" = ${vendorScope}::uuid
            `
          : this.prisma.$queryRaw<{ total: { toString(): string } | string | null }[]>`
              SELECT COALESCE(SUM("grandTotal"), 0) AS total
              FROM invoices
              WHERE "createdAt" >= date_trunc('month', now())
            `,
      ]);

    return {
      counts: {
        openRfq,
        openPo,
        pendingInvoices,
        overdueInvoices,
        vendorCount,
        mtdSpend: Number(mtdSpend[0]?.total ?? 0),
      },
      recent: {
        purchaseOrders: recentPos,
        invoices: recentInvoices,
      },
    };
  }

  // ============================================================
  // Spend by vendor
  // ============================================================
  async spendByVendor(q: ReportQueryDto, user: AuthPrincipal) {
    if (user.role === UserRole.VENDOR) {
      q.vendorId = user.vendorCompanyId ?? '__none__';
    }
    const where: Prisma.InvoiceWhereInput = {
      status: { in: [InvoiceStatus.PAID] },
    };
    if (q.vendorId) where.vendorId = q.vendorId;
    if (q.from || q.to) {
      where.paidAt = {
        ...(q.from ? { gte: q.from } : {}),
        ...(q.to ? { lte: q.to } : {}),
      };
    }
    const rows = await this.prisma.invoice.groupBy({
      by: ['vendorId'],
      where,
      _sum: { grandTotal: true },
      _count: { _all: true },
    });
    const vendorIds = rows.map((r) => r.vendorId);
    const vendors = await this.prisma.vendorCompany.findMany({
      where: { id: { in: vendorIds } },
      select: { id: true, displayName: true, legalName: true },
    });
    const byId = new Map(vendors.map((v) => [v.id, v]));
    return rows
      .map((r) => ({
        vendor: byId.get(r.vendorId) ?? { id: r.vendorId, displayName: 'Unknown', legalName: 'Unknown' },
        totalSpend: Number(r._sum.grandTotal ?? 0),
        invoiceCount: r._count._all,
      }))
      .sort((a, b) => b.totalSpend - a.totalSpend);
  }

  // ============================================================
  // Monthly trend (last 12 months)
  // ============================================================
  async monthlyTrend(q: ReportQueryDto, user: AuthPrincipal) {
    const vendorId = user.role === UserRole.VENDOR ? user.vendorCompanyId ?? '__none__' : q.vendorId;
    const result = vendorId
      ? await this.prisma.$queryRaw<{ month: Date; total: { toString(): string } | string | null; count: { toString(): string } | string | null }[]>`
          SELECT
            date_trunc('month', "createdAt") AS month,
            COALESCE(SUM("grandTotal"), 0) AS total,
            COUNT(*) AS count
          FROM invoices
          WHERE "createdAt" >= now() - interval '12 months'
            AND "vendorId" = ${vendorId}::uuid
          GROUP BY 1
          ORDER BY 1 ASC
        `
      : await this.prisma.$queryRaw<{ month: Date; total: { toString(): string } | string | null; count: { toString(): string } | string | null }[]>`
          SELECT
            date_trunc('month', "createdAt") AS month,
            COALESCE(SUM("grandTotal"), 0) AS total,
            COUNT(*) AS count
          FROM invoices
          WHERE "createdAt" >= now() - interval '12 months'
          GROUP BY 1
          ORDER BY 1 ASC
        `;
    return result.map((r) => ({
      month: r.month,
      total: Number(r.total ?? 0),
      count: Number(r.count ?? 0),
    }));
  }

  // ============================================================
  // Vendor performance
  // ============================================================
  async vendorPerformance(q: ReportQueryDto, user: AuthPrincipal) {
    if (user.role === UserRole.VENDOR) throw forbidden('Vendors may not view vendor-performance reports');
    const where: Prisma.PurchaseOrderWhereInput = {};
    if (q.vendorId) where.vendorId = q.vendorId;
    if (q.from || q.to) {
      where.generatedAt = {
        ...(q.from ? { gte: q.from } : {}),
        ...(q.to ? { lte: q.to } : {}),
      };
    }
    const pos = await this.prisma.purchaseOrder.findMany({
      where,
      include: { vendor: true },
    });
    const byVendor = new Map<string, { vendor: { id: string; displayName: string }; total: number; delivered: number; count: number }>();
    for (const po of pos) {
      const k = po.vendorId;
      const cur = byVendor.get(k) ?? { vendor: { id: po.vendor.id, displayName: po.vendor.displayName }, total: 0, delivered: 0, count: 0 };
      cur.total += Number(po.grandTotal);
      cur.count += 1;
      if (po.status === 'DELIVERED') cur.delivered += 1;
      byVendor.set(k, cur);
    }
    return Array.from(byVendor.values()).map((r) => ({
      ...r,
      onTimeDeliveryRate: r.count > 0 ? +(r.delivered / r.count * 100).toFixed(1) : 0,
    })).sort((a, b) => b.total - a.total);
  }

  // ============================================================
  // CSV exports
  // ============================================================
  async spendByVendorCsv(q: ReportQueryDto, user: AuthPrincipal): Promise<string> {
    const rows = await this.spendByVendor(q, user);
    const lines = ['vendorId,vendorName,totalSpend,invoiceCount'];
    for (const r of rows) {
      lines.push(`${r.vendor.id},${csvCell(r.vendor.displayName)},${r.totalSpend.toFixed(2)},${r.invoiceCount}`);
    }
    return '\uFEFF' + lines.join('\n');
  }

  async monthlyTrendCsv(q: ReportQueryDto, user: AuthPrincipal): Promise<string> {
    const rows = await this.monthlyTrend(q, user);
    const lines = ['month,total,count'];
    for (const r of rows) {
      lines.push(`${r.month.toISOString().substring(0, 7)},${r.total.toFixed(2)},${r.count}`);
    }
    return '\uFEFF' + lines.join('\n');
  }
}

function csvCell(v: string): string {
  if (v.includes(',') || v.includes('"') || v.includes('\n')) {
    return '"' + v.replace(/"/g, '""') + '"';
  }
  return v;
}
