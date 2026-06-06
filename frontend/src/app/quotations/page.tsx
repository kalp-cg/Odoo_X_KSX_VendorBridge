'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Plus, FileText, Search } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Button, Card, SearchInput, StatusPill, Pagination, Tabs, Table, THead, TBody, TR, TH, TD, EmptyState, Spinner } from '@/components/ui';
import { resources } from '@/lib/resources';
import type { QuotationStatus } from '@/lib/types';
import { fromNow, formatCurrency } from '@/lib/utils';
import { useRequireAuth } from '@/hooks/useRequireAuth';

const STATUS_TABS: { key: 'ALL' | QuotationStatus; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'SUBMITTED', label: 'Submitted' },
  { key: 'SHORTLISTED', label: 'Shortlisted' },
  { key: 'ACCEPTED', label: 'Accepted' },
  { key: 'REJECTED', label: 'Rejected' },
];

export default function QuotationsPage() {
  useRequireAuth();
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState<'ALL' | QuotationStatus>('ALL');
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['quotations', { page, tab, search }],
    queryFn: () =>
      resources.quotations.list({
        page,
        pageSize: 20,
        status: tab === 'ALL' ? undefined : tab,
      }),
  });

  return (
    <AppShell
      title="Quotations"
      subtitle="Vendor pricing submissions"
      actions={
        <Link href="/rfqs" className="btn-secondary">Browse RFQs</Link>
      }
    >
      <Card>
        <Tabs tabs={STATUS_TABS} value={tab} onChange={(k) => { setTab(k as 'ALL' | QuotationStatus); setPage(1); }} />
        {isLoading ? (
          <div className="py-12 flex justify-center"><Spinner /></div>
        ) : !data?.data?.length ? (
          <EmptyState title="No quotations" description="You haven't submitted any quotations yet." icon={<FileText className="h-12 w-12" />} />
        ) : (
          <>
            <Table>
              <THead>
                <TR>
                  <TH>Number</TH>
                  <TH>RFQ</TH>
                  <TH>Vendor</TH>
                  <TH>Status</TH>
                  <TH className="text-right">Total</TH>
                  <TH>Submitted</TH>
                </TR>
              </THead>
              <TBody>
                {data!.data.map((q: any) => (
                  <TR key={q.id}>
                    <TD className="font-mono text-xs"><Link href={`/quotations/${q.id}`} className="text-brand-700">{q.number}</Link></TD>
                    <TD className="text-xs">{q.rfq?.number ?? q.rfqNumber ?? q.rfqId}</TD>
                    <TD>{q.vendor?.displayName ?? q.vendorName ?? q.vendorId}</TD>
                    <TD><StatusPill status={q.status} /></TD>
                    <TD className="text-right">{formatCurrency(Number(q.totalAmount))}</TD>
                    <TD className="text-xs text-ink-500">{fromNow(q.submittedAt)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            {data.pagination && (
              <div className="mt-4"><Pagination pagination={data.pagination} onPageChange={setPage} /></div>
            )}
          </>
        )}
      </Card>
    </AppShell>
  );
}
