'use client';

import { useQuery } from '@tanstack/react-query';
import { Download, TrendingUp, Users, ShoppingCart, FileText } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { AppShell } from '@/components/layout/AppShell';
import { Card, CardHeader, StatusPill, Spinner } from '@/components/ui';
import { resources, csvUrl } from '@/lib/resources';
import { formatCurrency } from '@/lib/utils';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line } from 'recharts';
import { useRequireAuth } from '@/hooks/useRequireAuth';

export default function ReportsPage() {
  useRequireAuth(['ADMIN', 'OFFICER', 'MANAGER']);

  const { data: spend, isLoading: l1 } = useQuery({ queryKey: ['spend-by-vendor'], queryFn: () => resources.reports.spendByVendor() });
  const { data: trend, isLoading: l2 } = useQuery({ queryKey: ['monthly-trend'], queryFn: () => resources.reports.monthlyTrend() });
  const { data: perf, isLoading: l3 } = useQuery({ queryKey: ['vendor-performance'], queryFn: () => resources.reports.vendorPerformance() });
  const { data: dash } = useQuery({ queryKey: ['dashboard'], queryFn: () => resources.reports.dashboard() });

  if (l1 || l2 || l3) return <AppShell title="Reports"><Spinner /></AppShell>;

  const totalSpend = (spend?.data ?? []).reduce((acc, r) => acc + r.totalSpend, 0);

  return (
    <AppShell title="Reports" subtitle="Procurement analytics and exports">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        <Stat icon={ShoppingCart} label="MTD Spend" value={formatCurrency(dash?.data.counts.mtdSpend ?? 0)} />
        <Stat icon={Users} label="Vendors" value={dash?.data.counts.vendorCount ?? 0} />
        <Stat icon={TrendingUp} label="YTD Spend" value={formatCurrency(totalSpend)} />
        <Stat icon={FileText} label="Open POs" value={dash?.data.counts.openPo ?? 0} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader
            title="Spend by Vendor"
            description="Top vendors by total invoiced amount (PAID only)"
            action={
              <a href={csvUrl('/reports/spend-by-vendor.csv')} className="btn-ghost"><Download className="h-4 w-4" />CSV</a>
            }
          />
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={(spend?.data ?? []).slice(0, 8)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef0f3" />
                <XAxis dataKey="vendor.displayName" tick={{ fontSize: 11 }} stroke="#8b95a4" />
                <YAxis tick={{ fontSize: 11 }} stroke="#8b95a4" tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ borderRadius: 8, border: '1px solid #dee2e8' }} />
                <Bar dataKey="totalSpend" fill="#3a9b65" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Monthly Trend"
            description="Invoice totals over the last 12 months"
            action={
              <a href={csvUrl('/reports/monthly-trend.csv')} className="btn-ghost"><Download className="h-4 w-4" />CSV</a>
            }
          />
          <div className="h-72">
            <ResponsiveContainer>
              <LineChart data={(trend?.data ?? []).map((p) => ({ month: format(parseISO(String(p.month)), 'MMM yy'), total: p.total }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef0f3" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="#8b95a4" />
                <YAxis tick={{ fontSize: 11 }} stroke="#8b95a4" tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ borderRadius: 8, border: '1px solid #dee2e8' }} />
                <Line type="monotone" dataKey="total" stroke="#3a9b65" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Vendor Performance" description="Spend, on-time delivery, and average rating" />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-ink-500 uppercase">
              <tr className="border-b border-ink-100">
                <th className="text-left font-medium px-2 py-2">Vendor</th>
                <th className="text-right font-medium px-2 py-2">Total Spend</th>
                <th className="text-right font-medium px-2 py-2">POs</th>
                <th className="text-right font-medium px-2 py-2">Delivered</th>
                <th className="text-right font-medium px-2 py-2">On-Time %</th>
              </tr>
            </thead>
            <tbody>
              {(perf?.data ?? []).map((r) => (
                <tr key={r.vendor.id} className="border-b border-ink-100 last:border-0">
                  <td className="px-2 py-2.5 font-medium">{r.vendor.displayName}</td>
                  <td className="px-2 py-2.5 text-right">{formatCurrency(r.total)}</td>
                  <td className="px-2 py-2.5 text-right">{r.count}</td>
                  <td className="px-2 py-2.5 text-right">{r.delivered}</td>
                  <td className="px-2 py-2.5 text-right">
                    <span className={r.onTimeDeliveryRate >= 80 ? 'text-emerald-700' : r.onTimeDeliveryRate >= 50 ? 'text-amber-700' : 'text-red-700'}>
                      {r.onTimeDeliveryRate.toFixed(1)}%
                    </span>
                  </td>
                </tr>
              ))}
              {(!perf?.data || perf.data.length === 0) && (
                <tr><td colSpan={5} className="text-center py-6 text-ink-500">No data yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </AppShell>
  );
}

function Stat({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: React.ReactNode }) {
  return (
    <Card className="flex items-center gap-4">
      <div className="h-12 w-12 rounded-xl grid place-items-center bg-brand-50 text-brand-700">
        <Icon className="h-6 w-6" />
      </div>
      <div>
        <div className="text-xs uppercase tracking-wide text-ink-500 font-medium">{label}</div>
        <div className="text-2xl font-semibold text-ink-800 leading-tight mt-0.5">{value}</div>
      </div>
    </Card>
  );
}
