'use client';

import { use, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { ArrowLeft, Send, XCircle, CheckCircle2, GitCompare, FileSpreadsheet, Clock, Calendar, User } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Button, Card, CardHeader, StatusPill, Spinner, useToast, Modal, Field, Textarea, Table, THead, TBody, TR, TH, TD } from '@/components/ui';
import { resources } from '@/lib/resources';
import { formatCurrency, formatDate, formatDateTime, fromNow } from '@/lib/utils';
import { extractError } from '@/lib/api';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import type { Quotation } from '@/lib/types';

export default function RfqDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  useRequireAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['rfq', id],
    queryFn: () => resources.rfqs.get(id),
  });

  const { data: quotations } = useQuery({
    queryKey: ['rfq-quotations', id],
    queryFn: () => resources.quotations.list({ rfqId: id, pageSize: 100 }),
    enabled: !!data?.data,
  });

  const publish = useMutation({
    mutationFn: () => resources.rfqs.publish(id),
    onSuccess: () => { toast.success('Published'); qc.invalidateQueries({ queryKey: ['rfq', id] }); },
    onError: (err) => toast.error('Could not publish', extractError(err).message),
  });
  const close = useMutation({
    mutationFn: () => resources.rfqs.close(id),
    onSuccess: () => { toast.success('Closed'); qc.invalidateQueries({ queryKey: ['rfq', id] }); },
    onError: (err) => toast.error('Could not close', extractError(err).message),
  });
  const cancel = useMutation({
    mutationFn: (r: string) => resources.rfqs.cancel(id, r),
    onSuccess: () => { toast.success('Cancelled'); setCancelOpen(false); qc.invalidateQueries({ queryKey: ['rfq', id] }); },
    onError: (err) => toast.error('Could not cancel', extractError(err).message),
  });

  if (isLoading || !data?.data) return <AppShell title="RFQ"><Spinner /></AppShell>;
  const r = data.data;
  const qs = (quotations as { data?: Quotation[] } | undefined)?.data ?? [];
  const isExpired = new Date(r.deadline) < new Date();
  const isClosed = r.status === 'CLOSED' || r.status === 'CANCELLED';

  return (
    <AppShell
      title={`${r.number}`}
      subtitle={r.title}
      actions={
        <div className="flex flex-wrap gap-2">
          <Link href="/rfqs" className="btn-secondary"><ArrowLeft className="h-4 w-4" />Back</Link>
          {r.status === 'DRAFT' && (
            <Button leftIcon={<Send className="h-4 w-4" />} loading={publish.isPending} onClick={() => publish.mutate()}>Publish</Button>
          )}
          {r.status === 'PUBLISHED' && !isClosed && (
            <>
              <Link href={`/quotations/compare/${r.id}`} className="btn-secondary"><GitCompare className="h-4 w-4" />Compare</Link>
              <Button variant="secondary" leftIcon={<CheckCircle2 className="h-4 w-4" />} loading={close.isPending} onClick={() => close.mutate()}>Close</Button>
            </>
          )}
          {r.status === 'PUBLISHED' && (
            <Button variant="danger" leftIcon={<XCircle className="h-4 w-4" />} onClick={() => setCancelOpen(true)}>Cancel</Button>
          )}
        </div>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader title="Overview" icon={<FileSpreadsheet className="h-4 w-4" />} />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <Stat label="Status" value={<StatusPill status={r.status} />} />
            <Stat label="Deadline" value={formatDateTime(r.deadline)} icon={<Calendar className="h-3.5 w-3.5" />} />
            <Stat label="Published" value={r.publishedAt ? formatDateTime(r.publishedAt) : '—'} icon={<Clock className="h-3.5 w-3.5" />} />
            <Stat label="Created by" value={r.createdByName ?? r.createdById} icon={<User className="h-3.5 w-3.5" />} />
            <Stat label="Created" value={fromNow(r.createdAt)} />
            <Stat label="Quotations" value={qs.length} />
          </div>
          {r.description && (
            <>
              <h4 className="label mt-4 mb-1">Description</h4>
              <p className="text-sm text-ink-700 whitespace-pre-wrap">{r.description}</p>
            </>
          )}
        </Card>

        <Card>
          <CardHeader title="Invited Vendors" />
          {r.vendors && r.vendors.length > 0 ? (
            <ul className="space-y-2 text-sm">
              {r.vendors.map((v) => (
                <li key={v.id} className="flex justify-between gap-2">
                  <span className="text-ink-800 truncate">{v.vendorName ?? v.vendorId}</span>
                  <StatusPill status={v.status} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-500">No vendors invited.</p>
          )}
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Line Items" />
        {r.lineItems && r.lineItems.length > 0 ? (
          <Table>
            <THead>
              <TR>
                <TH>#</TH>
                <TH>Description</TH>
                <TH>Qty</TH>
                <TH>Unit</TH>
                <TH className="text-right">Target Price</TH>
              </TR>
            </THead>
            <TBody>
              {r.lineItems.map((li) => (
                <TR key={li.id}>
                  <TD>{li.lineNo}</TD>
                  <TD>{li.description}</TD>
                  <TD>{String(li.quantity)}</TD>
                  <TD>{li.unit}</TD>
                  <TD className="text-right">{li.targetUnitPrice ? formatCurrency(Number(li.targetUnitPrice)) : '—'}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        ) : (
          <p className="text-sm text-ink-500">No line items.</p>
        )}
      </Card>

      {qs.length > 0 && (
        <Card className="mt-6">
          <CardHeader title={`Quotations (${qs.length})`} action={<Link href={`/quotations/compare/${r.id}`} className="text-xs">Compare →</Link>} />
          <Table>
            <THead>
              <TR>
                <TH>Number</TH>
                <TH>Vendor</TH>
                <TH>Status</TH>
                <TH className="text-right">Total</TH>
                <TH>Submitted</TH>
              </TR>
            </THead>
            <TBody>
              {qs.map((q) => (
                <TR key={q.id}>
                  <TD className="font-mono text-xs"><Link href={`/quotations/${q.id}`} className="text-brand-700">{q.number}</Link></TD>
                  <TD>{q.vendorName ?? q.vendorId}</TD>
                  <TD><StatusPill status={q.status} /></TD>
                  <TD className="text-right">{formatCurrency(Number(q.totalAmount))}</TD>
                  <TD className="text-xs text-ink-500">{fromNow(q.submittedAt)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      )}

      <Modal
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="Cancel RFQ"
        description="Provide a reason. This action cannot be undone."
        footer={
          <>
            <Button variant="secondary" onClick={() => setCancelOpen(false)}>Keep RFQ</Button>
            <Button variant="danger" loading={cancel.isPending} onClick={() => cancel.mutate(reason || 'No reason provided')}>Cancel RFQ</Button>
          </>
        }
      >
        <Field label="Reason" required>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why is this RFQ being cancelled?" />
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
