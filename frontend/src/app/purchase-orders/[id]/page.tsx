'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { ArrowLeft, FileDown, Printer, Mail, CheckCircle2, Truck } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Button, Card, CardHeader, StatusPill, Spinner, useToast, Table, THead, TBody, TR, TH, TD } from '@/components/ui';
import { resources, pdfUrl } from '@/lib/resources';
import { formatCurrency, formatDateTime, fromNow } from '@/lib/utils';
import { extractError } from '@/lib/api';
import { useAuthStore } from '@/lib/auth';
import { useRequireAuth } from '@/hooks/useRequireAuth';

export default function PurchaseOrderDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  useRequireAuth();
  const user = useAuthStore((s) => s.user);
  const toast = useToast();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['po', id],
    queryFn: () => resources.purchaseOrders.get(id),
  });

  const markSent = useMutation({
    mutationFn: () => resources.purchaseOrders.markSent(id),
    onSuccess: () => { toast.success('Marked as sent'); qc.invalidateQueries({ queryKey: ['po', id] }); },
    onError: (err) => toast.error('Failed', extractError(err).message),
  });
  const markDelivered = useMutation({
    mutationFn: () => resources.purchaseOrders.markDelivered(id),
    onSuccess: () => { toast.success('Marked as delivered'); qc.invalidateQueries({ queryKey: ['po', id] }); },
    onError: (err) => toast.error('Failed', extractError(err).message),
  });

  if (isLoading || !data?.data) return <AppShell title="PO"><Spinner /></AppShell>;
  const p = data.data;
  const isStaff = user?.role === 'ADMIN' || user?.role === 'OFFICER';

  return (
    <AppShell
      title={p.number}
      subtitle={`Vendor: ${(p as any).vendor?.displayName ?? p.vendorName}`}
      actions={
        <div className="flex gap-2">
          <Link href="/purchase-orders" className="btn-secondary"><ArrowLeft className="h-4 w-4" />Back</Link>
          <button onClick={async () => {
            try {
              const { api } = await import('@/lib/api');
              const res = await api.get(`/purchase-orders/${p.id}/pdf`, { responseType: 'blob' });
              const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
              const a = document.createElement('a');
              a.href = url;
              a.download = `${p.number}.pdf`;
              a.click();
              URL.revokeObjectURL(url);
            } catch { /* ignore */ }
          }} className="btn-secondary"><FileDown className="h-4 w-4" />PDF</button>
          <button onClick={() => window.print()} className="btn-secondary"><Printer className="h-4 w-4" />Print</button>
          {p.invoiceId && (
            <Link href={`/invoices/${p.invoiceId}`} className="btn-secondary"><Mail className="h-4 w-4" />Invoice</Link>
          )}
          {isStaff && p.status === 'GENERATED' && (
            <Button leftIcon={<CheckCircle2 className="h-4 w-4" />} loading={markSent.isPending} onClick={() => markSent.mutate()}>Mark Sent</Button>
          )}
          {isStaff && p.status === 'SENT' && (
            <Button leftIcon={<Truck className="h-4 w-4" />} loading={markDelivered.isPending} onClick={() => markDelivered.mutate()}>Mark Delivered</Button>
          )}
        </div>
      }
    >
      <Card>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm mb-4">
          <Stat label="Status" value={<StatusPill status={p.status} />} />
          <Stat label="Generated" value={formatDateTime(p.generatedAt)} />
          <Stat label="Sent" value={p.sentAt ? formatDateTime(p.sentAt) : '—'} />
          <Stat label="Delivered" value={p.deliveredAt ? formatDateTime(p.deliveredAt) : '—'} />
        </div>
        <CardHeader title="Line Items" />
        {p.lineItems && p.lineItems.length > 0 ? (
          <Table>
            <THead>
              <TR>
                <TH>#</TH>
                <TH>Description</TH>
                <TH>Qty</TH>
                <TH>Unit</TH>
                <TH className="text-right">Unit Price</TH>
                <TH className="text-right">Total</TH>
              </TR>
            </THead>
            <TBody>
              {p.lineItems.map((li) => (
                <TR key={li.id}>
                  <TD>{li.lineNo}</TD>
                  <TD>{li.description}</TD>
                  <TD>{String(li.quantity)}</TD>
                  <TD>{li.unit}</TD>
                  <TD className="text-right">{formatCurrency(Number(li.unitPrice))}</TD>
                  <TD className="text-right">{formatCurrency(Number(li.lineTotal ?? (Number(li.unitPrice) * Number(li.quantity))))}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        ) : <p className="text-sm text-ink-500">No line items.</p>}
        <div className="mt-4 flex justify-end">
          <div className="w-72 space-y-1.5 text-sm">
            <Row label="Subtotal" value={formatCurrency(Number(p.totalAmount))} />
            <Row label={`Tax (${String(p.taxRatePercent)}%)`} value={formatCurrency(Number(p.taxAmount))} />
            <div className="border-t border-ink-200 pt-1.5">
              <Row label="Grand Total" value={formatCurrency(Number(p.grandTotal))} bold />
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
