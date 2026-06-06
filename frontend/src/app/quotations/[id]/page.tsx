'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, XCircle, Lock, FileText } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Button, Card, CardHeader, StatusPill, Spinner, useToast, Modal, Table, THead, TBody, TR, TH, TD, Field, Textarea } from '@/components/ui';
import { resources } from '@/lib/resources';
import { formatCurrency, formatDate, fromNow } from '@/lib/utils';
import { extractError } from '@/lib/api';
import { useAuthStore } from '@/lib/auth';
import { useRequireAuth } from '@/hooks/useRequireAuth';

export default function QuotationDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  useRequireAuth();
  const user = useAuthStore((s) => s.user);
  const toast = useToast();
  const qc = useQueryClient();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['quotation', id],
    queryFn: () => resources.quotations.get(id),
  });

  const shortlist = useMutation({
    mutationFn: () => resources.quotations.shortlist(id),
    onSuccess: () => { toast.success('Shortlisted'); qc.invalidateQueries({ queryKey: ['quotation', id] }); },
    onError: (err) => toast.error('Could not shortlist', extractError(err).message),
  });
  const reject = useMutation({
    mutationFn: (r: string) => resources.quotations.reject(id, r),
    onSuccess: () => { toast.success('Rejected'); setRejectOpen(false); qc.invalidateQueries({ queryKey: ['quotation', id] }); },
    onError: (err) => toast.error('Could not reject', extractError(err).message),
  });

  if (isLoading || !data?.data) return <AppShell title="Quotation"><Spinner /></AppShell>;
  const q = data.data;
  const isOfficerOrAdmin = user?.role === 'ADMIN' || user?.role === 'OFFICER';
  const canShortlist = isOfficerOrAdmin && q.status === 'SUBMITTED';

  return (
    <AppShell
      title={`${q.number}`}
      subtitle={(q as any).rfq?.number ? `For ${(q as any).rfq.number}` : q.rfqNumber ? `For ${q.rfqNumber}` : undefined}
      actions={
        <div className="flex gap-2">
          <Link href="/quotations" className="btn-secondary"><ArrowLeft className="h-4 w-4" />Back</Link>
          {q.rfqId && (
            <Link href={`/rfqs/${q.rfqId}`} className="btn-secondary">View RFQ</Link>
          )}
          {canShortlist && (
            <>
              <Button leftIcon={<CheckCircle2 className="h-4 w-4" />} onClick={() => shortlist.mutate()} loading={shortlist.isPending}>Shortlist</Button>
              <Button variant="danger" leftIcon={<XCircle className="h-4 w-4" />} onClick={() => setRejectOpen(true)}>Reject</Button>
            </>
          )}
        </div>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader title="Overview" icon={<FileText className="h-4 w-4" />} />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
            <Stat label="Status" value={<StatusPill status={q.status} />} />
            <Stat label="Vendor" value={(q as any).vendor?.displayName ?? q.vendorName ?? q.vendorId} />
            <Stat label="Submitted" value={fromNow(q.submittedAt)} />
            <Stat label="Delivery Date" value={q.deliveryDate ? formatDate(q.deliveryDate) : '—'} />
            <Stat label="Total" value={formatCurrency(Number(q.totalAmount))} />
            <Stat label="Locked" value={q.isLocked ? 'Yes' : 'No'} icon={q.isLocked ? <Lock className="h-3.5 w-3.5" /> : undefined} />
          </div>
          {q.notes && (
            <>
              <h4 className="label mt-4 mb-1">Notes</h4>
              <p className="text-sm text-ink-700 whitespace-pre-wrap">{q.notes}</p>
            </>
          )}
        </Card>

        <Card>
          <CardHeader title="Quick Actions" />
          <div className="space-y-2 text-sm">
            {q.rfqId && (
              <Link href={`/quotations/compare/${q.rfqId}`} className="block px-3 py-2 rounded-lg hover:bg-ink-50 border border-ink-100">
                Compare with other quotations →
              </Link>
            )}
            {q.rfqId && (
              <Link href={`/rfqs/${q.rfqId}`} className="block px-3 py-2 rounded-lg hover:bg-ink-50 border border-ink-100">
                View RFQ →
              </Link>
            )}
          </div>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Line Items" />
        {q.lineItems && q.lineItems.length > 0 ? (
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
              {q.lineItems.map((li) => (
                <TR key={li.id}>
                  <TD>{li.lineNo}</TD>
                  <TD>{li.description}</TD>
                  <TD>{String(li.quantity)}</TD>
                  <TD>{li.unit}</TD>
                  <TD className="text-right">{formatCurrency(Number(li.unitPrice))}</TD>
                  <TD className="text-right">{formatCurrency(Number(li.lineTotal ?? (Number(li.unitPrice) * Number(li.quantity))))}</TD>
                </TR>
              ))}
              <TR>
                <TD colSpan={5} className="text-right font-semibold">Grand Total</TD>
                <TD className="text-right font-semibold">{formatCurrency(Number(q.totalAmount))}</TD>
              </TR>
            </TBody>
          </Table>
        ) : (
          <p className="text-sm text-ink-500">No line items.</p>
        )}
      </Card>

      <Modal
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        title="Reject Quotation"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRejectOpen(false)}>Cancel</Button>
            <Button variant="danger" loading={reject.isPending} onClick={() => reject.mutate(reason || 'No reason provided')}>Reject</Button>
          </>
        }
      >
        <Field label="Reason" required>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why is this quotation being rejected?" />
        </Field>
      </Modal>
    </AppShell>
  );
}

function Stat({ label, value, icon }: { label: string; value: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div>
      <div className="label flex items-center gap-1">{icon}{label}</div>
      <div className="text-sm text-ink-800 mt-0.5">{value}</div>
    </div>
  );
}
