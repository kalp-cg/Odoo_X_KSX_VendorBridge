'use client';

import { useQuery } from '@tanstack/react-query';
import { AppShell } from '@/components/layout/AppShell';
import { Card, CardHeader, StatusPill, PageSpinner } from '@/components/ui';
import { resources } from '@/lib/resources';
import { formatCurrency, fromNow } from '@/lib/utils';
import { Users, FileSpreadsheet, FileText, ShoppingCart, ShieldCheck, AlertTriangle, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { useAuthStore } from '@/lib/auth';
import { format, parseISO } from 'date-fns';

function StatCard({
  icon: Icon,
  label,
  value,
  tone = 'brand',
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  tone?: 'brand' | 'blue' | 'violet' | 'amber' | 'red';
  hint?: string;
}) {
  const TONE: Record<string, string> = {
    brand: 'bg-brand-50 text-brand-700',
    blue: 'bg-blue-50 text-blue-700',
    violet: 'bg-violet-50 text-violet-700',
    amber: 'bg-amber-50 text-amber-700',
    red: 'bg-red-50 text-red-700',
  };
  return (
    <Card className="flex items-center gap-4">
      <div className={`h-12 w-12 rounded-xl grid place-items-center ${TONE[tone]}`}>
        <Icon className="h-6 w-6" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xs uppercase tracking-wide text-ink-500 font-medium">{label}</div>
        <div className="text-2xl font-semibold text-ink-800 leading-tight mt-0.5">{value}</div>
        {hint && <div className="text-xs text-ink-500 mt-0.5">{hint}</div>}
      </div>
    </Card>
  );
}

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);

  if (user?.role === 'VENDOR') {
    return (
      <AppShell title="Dashboard" subtitle="Your quotations and purchase orders at a glance">
        <VendorDashboard />
      </AppShell>
    );
  }

  return (
    <AppShell title="Dashboard" subtitle={`Welcome back, ${user?.fullName ?? ''}`}>
      <AdminOfficerDashboard />
    </AppShell>
  );
}

function AdminOfficerDashboard() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['reports-dashboard'],
    queryFn: () => resources.reports.dashboard(),
  });
  const { data: trend } = useQuery({
    queryKey: ['reports-monthly-trend'],
    queryFn: () => resources.reports.monthlyTrend(),
  });

  if (isLoading) return <PageSpinner />;
  if (error || !data?.data) {
    return (
      <Card>
        <div className="text-center py-8 text-ink-500">Unable to load dashboard data.</div>
      </Card>
    );
  }

  const c = data.data.counts;
  const r = data.data.recent;
  const trendData = (trend?.data ?? []).map((p) => ({
    month: typeof p.month === 'string' ? p.month : format(parseISO(String(p.month)), 'MMM yy'),
    total: p.total,
  }));

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon={Users} label="Vendors" value={c.vendorCount} />
        <StatCard icon={FileSpreadsheet} label="Open RFQs" value={c.openRfq} tone="blue" />
        <StatCard icon={ShoppingCart} label="Open POs" value={c.openPo} tone="violet" />
        <StatCard icon={ShieldCheck} label="Pending Invoices" value={c.pendingInvoices} tone="amber" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon={AlertTriangle} label="Overdue Invoices" value={c.overdueInvoices} tone="red" />
        <StatCard icon={TrendingUp} label="Month-to-Date Spend" value={formatCurrency(c.mtdSpend)} tone="brand" />
        <StatCard icon={FileText} label="Avg Approval Time" value="1.4d" tone="blue" hint="last 30 days" />
        <StatCard icon={FileText} label="Active Cycles" value={c.openRfq + c.openPo} tone="violet" hint="RFQ + PO" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader title="Monthly Spend Trend" description="Last 12 months" />
          <div className="h-72">
            <ResponsiveContainer>
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3a9b65" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#3a9b65" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef0f3" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#8b95a4" />
                <YAxis tick={{ fontSize: 12 }} stroke="#8b95a4" tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ borderRadius: 8, border: '1px solid #dee2e8' }} />
                <Area type="monotone" dataKey="total" stroke="#3a9b65" fill="url(#grad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHeader title="Recent Invoices" action={<Link href="/invoices" className="text-xs">View all</Link>} />
          <ul className="space-y-3">
            {r.invoices.slice(0, 6).map((i: any) => (
              <li key={i.id} className="flex items-start justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <Link href={`/invoices/${i.id}`} className="font-medium text-ink-800 hover:text-brand-700 block truncate">
                    {i.number}
                  </Link>
                  <div className="text-xs text-ink-500 mt-0.5">
                    {i.vendor?.displayName ?? i.vendorName ?? '—'} · {fromNow(i.createdAt)}
                  </div>
                </div>
                <StatusPill status={i.status} />
              </li>
            ))}
            {r.invoices.length === 0 && <li className="text-sm text-ink-500">No recent invoices.</li>}
          </ul>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Recent Purchase Orders" action={<Link href="/purchase-orders" className="text-xs">View all</Link>} />
        <div className="overflow-x-auto -mx-2">
          <table className="w-full text-sm">
            <thead className="text-xs text-ink-500 uppercase">
              <tr className="border-b border-ink-100">
                <th className="text-left font-medium px-2 py-2">Number</th>
                <th className="text-left font-medium px-2 py-2">Vendor</th>
                <th className="text-left font-medium px-2 py-2">Status</th>
                <th className="text-right font-medium px-2 py-2">Total</th>
                <th className="text-left font-medium px-2 py-2">Generated</th>
              </tr>
            </thead>
            <tbody>
              {r.purchaseOrders.slice(0, 6).map((p: any) => (
                <tr key={p.id} className="border-b border-ink-100 last:border-0">
                  <td className="px-2 py-2.5 font-medium">
                    <Link href={`/purchase-orders/${p.id}`} className="text-brand-700">{p.number}</Link>
                  </td>
                  <td className="px-2 py-2.5">{p.vendor?.displayName ?? p.vendorName ?? '—'}</td>
                  <td className="px-2 py-2.5"><StatusPill status={p.status} /></td>
                  <td className="px-2 py-2.5 text-right">{formatCurrency(Number(p.grandTotal))}</td>
                  <td className="px-2 py-2.5 text-ink-500">{fromNow(p.generatedAt)}</td>
                </tr>
              ))}
              {r.purchaseOrders.length === 0 && (
                <tr><td colSpan={5} className="text-center py-6 text-ink-500">No purchase orders yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

function VendorDashboard() {
  const { data: quotations, isLoading } = useQuery({
    queryKey: ['my-quotations'],
    queryFn: () => resources.quotations.list({ page: 1, pageSize: 5 }),
  });
  const { data: pos } = useQuery({
    queryKey: ['my-pos'],
    queryFn: () => resources.purchaseOrders.list({ page: 1, pageSize: 5 }),
  });
  const { data: rfqs } = useQuery({
    queryKey: ['available-rfqs'],
    queryFn: () => resources.rfqs.list({ page: 1, pageSize: 5, status: 'PUBLISHED' as const }),
  });

  if (isLoading) return <PageSpinner />;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader title="Open RFQs" description="Submit your quotation" action={<Link href="/rfqs" className="text-xs">View all</Link>} />
        <ul className="divide-y divide-ink-100">
          {rfqs?.data?.slice(0, 5).map((r) => (
            <li key={r.id} className="py-3 flex justify-between gap-3">
              <div className="min-w-0">
                <Link href={`/quotations/new?rfqId=${r.id}`} className="font-medium text-ink-800 hover:text-brand-700 block truncate">
                  {r.title}
                </Link>
                <div className="text-xs text-ink-500 mt-0.5">
                  {r.number} · Deadline {new Date(r.deadline).toLocaleDateString()}
                </div>
              </div>
              <StatusPill status={r.status} />
            </li>
          ))}
          {(!rfqs?.data || rfqs.data.length === 0) && <li className="py-6 text-sm text-ink-500 text-center">No open RFQs.</li>}
        </ul>
      </Card>

      <Card>
        <CardHeader title="My Quotations" action={<Link href="/quotations" className="text-xs">View all</Link>} />
        <ul className="divide-y divide-ink-100">
          {quotations?.data?.map((q: any) => (
            <li key={q.id} className="py-3 flex justify-between gap-3">
              <div className="min-w-0">
                <Link href={`/quotations/${q.id}`} className="font-medium text-ink-800 hover:text-brand-700 block truncate">
                  {q.number}
                </Link>
                <div className="text-xs text-ink-500 mt-0.5">
                  {q.rfq?.number ?? q.rfqNumber ?? ''} · {formatCurrency(Number(q.totalAmount))}
                </div>
              </div>
              <StatusPill status={q.status} />
            </li>
          ))}
          {(!quotations?.data || quotations.data.length === 0) && <li className="py-6 text-sm text-ink-500 text-center">No quotations yet.</li>}
        </ul>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader title="My Purchase Orders" action={<Link href="/purchase-orders" className="text-xs">View all</Link>} />
        <div className="overflow-x-auto -mx-2">
          <table className="w-full text-sm">
            <thead className="text-xs text-ink-500 uppercase">
              <tr className="border-b border-ink-100">
                <th className="text-left font-medium px-2 py-2">Number</th>
                <th className="text-left font-medium px-2 py-2">RFQ</th>
                <th className="text-left font-medium px-2 py-2">Status</th>
                <th className="text-right font-medium px-2 py-2">Total</th>
              </tr>
            </thead>
            <tbody>
              {pos?.data?.map((p) => (
                <tr key={p.id} className="border-b border-ink-100 last:border-0">
                  <td className="px-2 py-2.5 font-medium">
                    <Link href={`/purchase-orders/${p.id}`} className="text-brand-700">{p.number}</Link>
                  </td>
                  <td className="px-2 py-2.5">{p.number}</td>
                  <td className="px-2 py-2.5"><StatusPill status={p.status} /></td>
                  <td className="px-2 py-2.5 text-right">{formatCurrency(Number(p.grandTotal))}</td>
                </tr>
              ))}
              {(!pos?.data || pos.data.length === 0) && (
                <tr><td colSpan={4} className="text-center py-6 text-ink-500">No purchase orders yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
