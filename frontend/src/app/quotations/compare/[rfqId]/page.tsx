'use client';

import { use, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { ArrowLeft, GitCompare, CheckCircle2, XCircle } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Button, Card, CardHeader, StatusPill, Spinner, useToast, Modal, Table, THead, TBody, TR, TH, TD, Field, Textarea } from '@/components/ui';
import { resources } from '@/lib/resources';
import { formatCurrency, formatDate } from '@/lib/utils';
import { extractError } from '@/lib/api';
import { useAuthStore } from '@/lib/auth';
import { useRequireAuth } from '@/hooks/useRequireAuth';

export default function CompareQuotationsPage({ params }: { params: Promise<{ rfqId: string }> }) {
  const { rfqId } = use(params);
  useRequireAuth();
  const user = useAuthStore((s) => s.user);
  const toast = useToast();
  const qc = useQueryClient();
  const [rejectFor, setRejectFor] = useState<{ id: string; open: boolean } | null>(null);
  const [reason, setReason] = useState('');

  const { data: rfq } = useQuery({
    queryKey: ['rfq', rfqId],
    queryFn: () => resources.rfqs.get(rfqId),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['rfq-compare', rfqId],
    queryFn: () => resources.quotations.compareByRfq(rfqId),
  });

  const shortlist = useMutation({
    mutationFn: (id: string) => resources.quotations.shortlist(id),
    onSuccess: () => { toast.success('Shortlisted'); qc.invalidateQueries({ queryKey: ['rfq-compare', rfqId] }); },
    onError: (err) => toast.error('Could not shortlist', extractError(err).message),
  });
  const reject = useMutation({
    mutationFn: ({ id, r }: { id: string; r: string }) => resources.quotations.reject(id, r),
    onSuccess: () => { toast.success('Rejected'); setRejectFor(null); qc.invalidateQueries({ queryKey: ['rfq-compare', rfqId] }); },
    onError: (err) => toast.error('Could not reject', extractError(err).message),
  });

  if (isLoading || !data?.data || !rfq?.data) return <AppShell title="Compare"><Spinner /></AppShell>;
  const qs = data.data;
  const lineItems = rfq.data.lineItems ?? [];
  const isOfficerOrAdmin = user?.role === 'ADMIN' || user?.role === 'OFFICER';

  const lowestPerLine = lineItems.map((li) => {
    let min: number | null = null;
    qs.forEach((q) => {
      const item = q.lineItems?.find((x) => x.description === li.description);
      if (item && item.unitPrice) {
        const p = Number(item.unitPrice);
        if (min === null || p < min) min = p;
      }
    });
    return min;
  });

  return (
    <AppShell
      title="Quotation Comparison"
      subtitle={`${rfq.data.number} — ${rfq.data.title}`}
      actions={
        <div className="flex gap-2">
          <Link href={`/rfqs/${rfqId}`} className="btn-secondary"><ArrowLeft className="h-4 w-4" />Back to RFQ</Link>
        </div>
      }
    >
      <Card>
        <CardHeader title="Side-by-side" description="Lowest unit price per line is highlighted in green." icon={<GitCompare className="h-4 w-4" />} />
        {qs.length === 0 ? (
          <p className="text-sm text-ink-500 py-6 text-center">No quotations submitted yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-200 text-xs uppercase text-ink-500">
                  <th className="text-left font-medium py-2 px-2 sticky left-0 bg-white min-w-[200px]">Line</th>
                  {qs.map((q) => (
                    <th key={q.id} className="text-left font-medium py-2 px-2 min-w-[180px]">
                      <div className="space-y-1">
                        <div className="text-sm normal-case text-ink-800 font-semibold">{q.vendorName}</div>
                        <div className="text-[10px] text-ink-500 font-mono">{q.number}</div>
                        <StatusPill status={q.status} />
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lineItems.map((li, idx) => (
                  <tr key={li.id} className="border-b border-ink-100">
                    <td className="py-2 px-2 sticky left-0 bg-white">
                      <div className="font-medium text-ink-800">{li.description}</div>
                      <div className="text-xs text-ink-500">Qty: {String(li.quantity)} {li.unit}</div>
                    </td>
                    {qs.map((q) => {
                      const item = q.lineItems?.find((x) => x.description === li.description);
                      const isLow = item && lowestPerLine[idx] !== null && Number(item.unitPrice) === lowestPerLine[idx];
                      return (
                        <td key={q.id} className={`py-2 px-2 ${isLow ? 'bg-emerald-50' : ''}`}>
                          {item ? (
                            <div>
                              <div className="font-medium">{formatCurrency(Number(item.unitPrice))}</div>
                              <div className="text-xs text-ink-500">= {formatCurrency(Number(item.unitPrice) * Number(item.quantity))}</div>
                            </div>
                          ) : <span className="text-ink-300">—</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                <tr className="border-b border-ink-200 bg-ink-50 font-semibold">
                  <td className="py-2 px-2 sticky left-0 bg-ink-50">Total</td>
                  {qs.map((q) => (
                    <td key={q.id} className="py-2 px-2">{formatCurrency(Number(q.totalAmount))}</td>
                  ))}
                </tr>
                <tr className="border-b border-ink-100">
                  <td className="py-2 px-2 sticky left-0 bg-white text-xs text-ink-500">Delivery</td>
                  {qs.map((q) => <td key={q.id} className="py-2 px-2 text-xs">{q.deliveryDate ? formatDate(q.deliveryDate) : '—'}</td>)}
                </tr>
                {isOfficerOrAdmin && (
                  <tr>
                    <td className="py-3 px-2 sticky left-0 bg-white">Actions</td>
                    {qs.map((q) => (
                      <td key={q.id} className="py-3 px-2">
                        {q.status === 'SUBMITTED' ? (
                          <div className="flex flex-col gap-1">
                            <Button size="sm" onClick={() => shortlist.mutate(q.id)} loading={shortlist.isPending && shortlist.variables === q.id} leftIcon={<CheckCircle2 className="h-3.5 w-3.5" />}>
                              Shortlist
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setRejectFor({ id: q.id, open: true })} leftIcon={<XCircle className="h-3.5 w-3.5" />}>
                              Reject
                            </Button>
                          </div>
                        ) : (
                          <StatusPill status={q.status} />
                        )}
                      </td>
                    ))}
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={!!rejectFor?.open}
        onClose={() => setRejectFor(null)}
        title="Reject Quotation"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRejectFor(null)}>Cancel</Button>
            <Button variant="danger" loading={reject.isPending} onClick={() => rejectFor && reject.mutate({ id: rejectFor.id, r: reason || 'No reason provided' })}>Reject</Button>
          </>
        }
      >
        <Field label="Reason" required>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
      </Modal>
    </AppShell>
  );
}
