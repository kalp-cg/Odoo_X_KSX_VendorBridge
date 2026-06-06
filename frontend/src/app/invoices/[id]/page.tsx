'use client';


import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { ArrowLeft, FileDown, Printer, Mail, AlertTriangle } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Card, CardHeader, StatusPill, Spinner, Button } from '@/components/ui';
import { resources, pdfUrl } from '@/lib/resources';
import { formatCurrency, formatDate, isOverdue } from '@/lib/utils';
import { useRequireAuth } from '@/hooks/useRequireAuth';

export default function InvoiceDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  useRequireAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['invoice', id],
    queryFn: () => resources.invoices.get(id),
  });

  if (isLoading || !data?.data) return <AppShell title="Invoice"><Spinner /></AppShell>;
  const i = data.data;
  const overdue = i.status === 'PENDING' && isOverdue(i.dueDate);

  return (
    <AppShell
      title={i.number}
      subtitle={`Vendor: ${(i as any).vendor?.displayName ?? i.vendorName}`}
      actions={
        <div className="flex gap-2">
          <Link href="/invoices" className="btn-secondary"><ArrowLeft className="h-4 w-4" />Back</Link>
          <button onClick={async () => {
            try {
              const { api } = await import('@/lib/api');
              const res = await api.get(`/invoices/${i.id}/pdf`, { responseType: 'blob' });
              const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
              const a = document.createElement('a');
              a.href = url;
              a.download = `${i.number}.pdf`;
              a.click();
              URL.revokeObjectURL(url);
            } catch { /* ignore */ }
          }} className="btn-secondary"><FileDown className="h-4 w-4" />PDF</button>
          <button onClick={() => window.print()} className="btn-secondary"><Printer className="h-4 w-4" />Print</button>
          <Link href={`/purchase-orders/${i.purchaseOrderId}`} className="btn-secondary">View PO</Link>
        </div>
      }
    >
      <Card>
        <div className="flex items-center gap-3 mb-4">
          <StatusPill status={i.status} />
          {overdue && (
            <span className="inline-flex items-center gap-1 text-xs text-red-600">
              <AlertTriangle className="h-3.5 w-3.5" />Overdue since {formatDate(i.dueDate)}
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <Stat label="Issued" value={formatDate(i.issueDate)} />
          <Stat label="Due" value={formatDate(i.dueDate)} />
          <Stat label="Paid" value={i.paidAt ? formatDate(i.paidAt) : '—'} />
          <Stat label="Currency" value={i.currency} />
        </div>
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="label mb-1">Billed To</h4>
            <div className="text-sm text-ink-800">{(i as any).vendor?.displayName ?? i.vendorName}</div>
            <div className="text-xs text-ink-500">Vendor ID: {i.vendorId}</div>
          </div>
          <div>
            <h4 className="label mb-1">Reference</h4>
            <div className="text-sm text-ink-800">PO: <Link href={`/purchase-orders/${i.purchaseOrderId}`} className="text-brand-700">{(i as any).purchaseOrder?.number ?? i.purchaseOrderNumber ?? i.purchaseOrderId}</Link></div>
            <div className="text-xs text-ink-500">Approval: {i.approvalId}</div>
          </div>
        </div>

        <CardHeader title="Summary" className="mt-6" />
        <div className="flex justify-end">
          <div className="w-72 space-y-1.5 text-sm">
            <Row label="Subtotal" value={formatCurrency(Number(i.subtotal))} />
            <Row label={`Tax (${String(i.taxRatePercent)}%)`} value={formatCurrency(Number(i.taxAmount))} />
            <div className="border-t border-ink-200 pt-1.5">
              <Row label="Grand Total" value={formatCurrency(Number(i.grandTotal))} bold />
            </div>
          </div>
        </div>
      </Card>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return <div><div className="label">{label}</div><div className="text-sm text-ink-800 mt-0.5">{value}</div></div>;
}
function Row({ label, value, bold }: { label: string; value: React.ReactNode; bold?: boolean }) {
  return <div className={`flex justify-between ${bold ? 'text-base font-semibold' : ''}`}><span className="text-ink-600">{label}</span><span>{value}</span></div>;
}
