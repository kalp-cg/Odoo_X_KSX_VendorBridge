'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { CheckCircle2, FileDown, Send, AlertTriangle, Mail } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Button, Card, StatusPill, Pagination, Tabs, Table, THead, TBody, TR, TH, TD, Spinner, useToast, Modal, Field, Select, Input, Textarea } from '@/components/ui';
import { resources, pdfUrl } from '@/lib/resources';
import type { InvoiceStatus } from '@/lib/types';
import { fromNow, formatCurrency, formatDate, isOverdue } from '@/lib/utils';
import { extractError } from '@/lib/api';
import { useRequireAuth } from '@/hooks/useRequireAuth';

const TABS: { key: 'ALL' | InvoiceStatus; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'PENDING', label: 'Pending' },
  { key: 'PAID', label: 'Paid' },
  { key: 'OVERDUE', label: 'Overdue' },
];

export default function InvoicesPage() {
  useRequireAuth();
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState<'ALL' | InvoiceStatus>('ALL');
  const [payFor, setPayFor] = useState<string | null>(null);
  const toast = useToast();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['invoices', { page, tab }],
    queryFn: () => resources.invoices.list({ page, pageSize: 20, status: tab === 'ALL' ? undefined : tab }),
  });

  const pay = useMutation({
    mutationFn: ({ id, payment }: { id: string; payment: { amount: number; method: string; reference?: string } }) =>
      resources.invoices.markPaid(id, payment),
    onSuccess: () => { toast.success('Payment recorded'); setPayFor(null); qc.invalidateQueries({ queryKey: ['invoices'] }); },
    onError: (err) => toast.error('Failed', extractError(err).message),
  });
  const emailIt = useMutation({
    mutationFn: (id: string) => resources.invoices.sendEmail(id),
    onSuccess: () => toast.success('Email sent'),
    onError: (err) => toast.error('Failed', extractError(err).message),
  });

  return (
    <AppShell title="Invoices" subtitle="Track payable invoices">
      <Card>
        <Tabs tabs={TABS} value={tab} onChange={(k) => { setTab(k as 'ALL' | InvoiceStatus); setPage(1); }} />
        {isLoading ? (
          <div className="py-12 flex justify-center"><Spinner /></div>
        ) : (
          <>
            <Table>
              <THead>
                <TR>
                  <TH>Number</TH>
                  <TH>PO</TH>
                  <TH>Vendor</TH>
                  <TH>Status</TH>
                  <TH>Due</TH>
                  <TH className="text-right">Total</TH>
                  <TH>Actions</TH>
                </TR>
              </THead>
              <TBody>
                {data?.data?.map((i: any) => (
                  <TR key={i.id}>
                    <TD className="font-mono text-xs"><Link href={`/invoices/${i.id}`} className="text-brand-700">{i.number}</Link></TD>
                    <TD className="font-mono text-xs">{i.purchaseOrder?.number ?? i.purchaseOrderNumber ?? i.purchaseOrderId}</TD>
                    <TD>{i.vendor?.displayName ?? i.vendorName ?? i.vendorId}</TD>
                    <TD>
                      <div className="flex items-center gap-1">
                        <StatusPill status={i.status} />
                        {i.status === 'PENDING' && isOverdue(i.dueDate) && <AlertTriangle className="h-3.5 w-3.5 text-red-500" />}
                      </div>
                    </TD>
                    <TD className="text-xs">{formatDate(i.dueDate)}</TD>
                    <TD className="text-right">{formatCurrency(Number(i.grandTotal))}</TD>
                    <TD>
                      <div className="flex items-center gap-1">
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
                        }} className="text-ink-500 hover:text-brand-600 p-1" title="PDF">
                          <FileDown className="h-4 w-4" />
                        </button>
                        <button onClick={() => emailIt.mutate(i.id)} className="text-ink-500 hover:text-brand-600 p-1" title="Email"><Mail className="h-4 w-4" /></button>
                        {i.status !== 'PAID' && (
                          <Button size="sm" variant="ghost" leftIcon={<CheckCircle2 className="h-3.5 w-3.5" />} onClick={() => setPayFor(i.id)}>Pay</Button>
                        )}
                      </div>
                    </TD>
                  </TR>
                ))}
                {data?.data?.length === 0 && <TR><TD colSpan={7} className="text-center py-6 text-ink-500">No invoices.</TD></TR>}
              </TBody>
            </Table>
            {data?.pagination && <div className="mt-4"><Pagination pagination={data.pagination} onPageChange={setPage} /></div>}
          </>
        )}
      </Card>

      <PayModal open={!!payFor} onClose={() => setPayFor(null)} onSubmit={(payment) => payFor && pay.mutate({ id: payFor, payment })} loading={pay.isPending} />
    </AppShell>
  );
}

function PayModal({ open, onClose, onSubmit, loading }: { open: boolean; onClose: () => void; onSubmit: (p: { amount: number; method: string; reference?: string }) => void; loading: boolean }) {
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState('BANK_TRANSFER');
  const [reference, setReference] = useState('');

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record Payment"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSubmit({ amount: Number(amount), method, reference: reference || undefined })} loading={loading}>Confirm Payment</Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Amount" required>
          <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
        </Field>
        <Field label="Method" required>
          <Select value={method} onChange={(e) => setMethod(e.target.value)} options={[
            { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
            { value: 'CHEQUE', label: 'Cheque' },
            { value: 'CASH', label: 'Cash' },
            { value: 'UPI', label: 'UPI' },
            { value: 'CARD', label: 'Card' },
            { value: 'OTHER', label: 'Other' },
          ]} />
        </Field>
        <Field label="Reference">
          <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Txn ID, cheque #, etc." />
        </Field>
      </div>
    </Modal>
  );
}
