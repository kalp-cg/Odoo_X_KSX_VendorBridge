'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { ShieldCheck, CheckCircle2, XCircle } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Button, Card, CardHeader, StatusPill, Pagination, Tabs, Table, THead, TBody, TR, TH, TD, Spinner, useToast, Modal, Field, Textarea } from '@/components/ui';
import { resources } from '@/lib/resources';
import type { ApprovalStatus } from '@/lib/types';
import { fromNow, formatCurrency } from '@/lib/utils';
import { extractError } from '@/lib/api';
import { useRequireAuth } from '@/hooks/useRequireAuth';

const STATUS_TABS: { key: 'ALL' | ApprovalStatus; label: string }[] = [
  { key: 'PENDING', label: 'Pending' },
  { key: 'APPROVED', label: 'Approved' },
  { key: 'REJECTED', label: 'Rejected' },
  { key: 'ALL', label: 'All' },
];

export default function ApprovalsPage() {
  useRequireAuth(['ADMIN', 'MANAGER']);
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState<'ALL' | ApprovalStatus>('PENDING');
  const [rejectFor, setRejectFor] = useState<string | null>(null);
  const [remarks, setRemarks] = useState('');
  const toast = useToast();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['approvals', { page, tab }],
    queryFn: () =>
      resources.approvals.list({ page, pageSize: 20, status: tab === 'ALL' ? undefined : tab }),
  });

  const approve = useMutation({
    mutationFn: (id: string) => resources.approvals.approve(id),
    onSuccess: (res) => {
      toast.success('Approved', `PO ${res.data.purchaseOrder?.number ?? ''} and Invoice ${res.data.invoice?.number ?? ''} created.`);
      qc.invalidateQueries({ queryKey: ['approvals'] });
    },
    onError: (err) => toast.error('Could not approve', extractError(err).message),
  });
  const reject = useMutation({
    mutationFn: ({ id, r }: { id: string; r: string }) => resources.approvals.reject(id, r),
    onSuccess: () => { toast.success('Rejected'); setRejectFor(null); setRemarks(''); qc.invalidateQueries({ queryKey: ['approvals'] }); },
    onError: (err) => toast.error('Could not reject', extractError(err).message),
  });

  return (
    <AppShell title="Approvals" subtitle="Review and decide on shortlisted quotations">
      <Card>
        <CardHeader title="Approval Queue" icon={<ShieldCheck className="h-4 w-4" />} />
        <Tabs tabs={STATUS_TABS} value={tab} onChange={(k) => { setTab(k as 'ALL' | ApprovalStatus); setPage(1); }} />
        {isLoading ? (
          <div className="py-12 flex justify-center"><Spinner /></div>
        ) : (
          <>
            <Table>
              <THead>
                <TR>
                  <TH>RFQ</TH>
                  <TH>Quotation</TH>
                  <TH>Requested By</TH>
                  <TH>Status</TH>
                  <TH className="text-right">Total</TH>
                  <TH>Requested</TH>
                  <TH></TH>
                </TR>
              </THead>
              <TBody>
                {data?.data?.map((a) => (
                  <TR key={a.id}>
                    <TD className="text-xs">{a.rfqNumber ?? a.rfqId}</TD>
                    <TD className="font-mono text-xs">
                      <Link href={`/quotations/${a.quotationId}`} className="text-brand-700">{a.quotationNumber ?? a.quotationId}</Link>
                    </TD>
                    <TD>{a.requestedByName ?? a.requestedById}</TD>
                    <TD><StatusPill status={a.status} /></TD>
                    <TD className="text-right">{a.quotationTotal ? formatCurrency(Number(a.quotationTotal)) : '—'}</TD>
                    <TD className="text-xs text-ink-500">{fromNow(a.requestedAt)}</TD>
                    <TD className="text-right">
                      {a.status === 'PENDING' && (
                        <div className="flex justify-end gap-1">
                          <Button size="sm" leftIcon={<CheckCircle2 className="h-3.5 w-3.5" />} onClick={() => approve.mutate(a.id)} loading={approve.isPending && approve.variables === a.id}>
                            Approve
                          </Button>
                          <Button size="sm" variant="danger" leftIcon={<XCircle className="h-3.5 w-3.5" />} onClick={() => setRejectFor(a.id)}>
                            Reject
                          </Button>
                        </div>
                      )}
                    </TD>
                  </TR>
                ))}
                {data?.data?.length === 0 && (
                  <TR><TD colSpan={7} className="text-center py-6 text-ink-500">No approvals.</TD></TR>
                )}
              </TBody>
            </Table>
            {data?.pagination && (
              <div className="mt-4"><Pagination pagination={data.pagination} onPageChange={setPage} /></div>
            )}
          </>
        )}
      </Card>

      <Modal
        open={!!rejectFor}
        onClose={() => { setRejectFor(null); setRemarks(''); }}
        title="Reject Approval"
        description="Remarks are required and will be recorded in the audit log."
        footer={
          <>
            <Button variant="secondary" onClick={() => { setRejectFor(null); setRemarks(''); }}>Cancel</Button>
            <Button variant="danger" loading={reject.isPending} disabled={remarks.trim().length < 3} onClick={() => rejectFor && reject.mutate({ id: rejectFor, r: remarks })}>Reject</Button>
          </>
        }
      >
        <Field label="Remarks" required>
          <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Reason for rejection" />
        </Field>
      </Modal>
    </AppShell>
  );
}
