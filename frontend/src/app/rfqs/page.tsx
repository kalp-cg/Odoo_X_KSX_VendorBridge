'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Plus, FileSpreadsheet, Search } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Button, Card, SearchInput, StatusPill, Pagination, Tabs, Table, THead, TBody, TR, TH, TD, EmptyState, Spinner } from '@/components/ui';
import { resources } from '@/lib/resources';
import type { RfqStatus } from '@/lib/types';
import { fromNow, formatDate, formatCurrency } from '@/lib/utils';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useAuthStore } from '@/lib/auth';

const STATUS_TABS: { key: 'ALL' | RfqStatus; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'DRAFT', label: 'Draft' },
  { key: 'PUBLISHED', label: 'Published' },
  { key: 'CLOSED', label: 'Closed' },
  { key: 'CANCELLED', label: 'Cancelled' },
];

export default function RfqsPage() {
  useRequireAuth();
  const user = useAuthStore((s) => s.user);
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState<'ALL' | RfqStatus>('ALL');
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['rfqs', { page, tab, search }],
    queryFn: () =>
      resources.rfqs.list({
        page,
        pageSize: 20,
        status: tab === 'ALL' ? undefined : tab,
        search: search || undefined,
      }),
  });

  return (
    <AppShell
      title="RFQs"
      subtitle="Request for Quotations"
      actions={
        user?.role !== 'VENDOR' ? (
          <Link href="/rfqs/new" className="btn-primary">
            <Plus className="h-4 w-4" />New RFQ
          </Link>
        ) : null
      }
    >
      <Card>
        <div className="flex flex-col md:flex-row gap-3 mb-4">
          <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search RFQs…" className="md:w-80" />
        </div>
        <Tabs tabs={STATUS_TABS} value={tab} onChange={(k) => { setTab(k as 'ALL' | RfqStatus); setPage(1); }} />
        {isLoading ? (
          <div className="py-12 flex justify-center"><Spinner /></div>
        ) : !data?.data?.length ? (
          <EmptyState
            title="No RFQs"
            description="Create your first RFQ to begin gathering vendor quotations."
            icon={<FileSpreadsheet className="h-12 w-12" />}
            action={<Link href="/rfqs/new" className="btn-primary"><Plus className="h-4 w-4" />New RFQ</Link>}
          />
        ) : (
          <>
            <Table>
              <THead>
                <TR>
                  <TH>Number</TH>
                  <TH>Title</TH>
                  <TH>Status</TH>
                  <TH>Deadline</TH>
                  <TH>Quotations</TH>
                  <TH>Created</TH>
                </TR>
              </THead>
              <TBody>
                {data!.data.map((r: any) => (
                  <TR key={r.id}>
                    <TD className="font-mono text-xs">
                      <Link href={`/rfqs/${r.id}`} className="text-brand-700">{r.number}</Link>
                    </TD>
                    <TD>
                      <Link href={`/rfqs/${r.id}`} className="font-medium text-ink-800 hover:text-brand-700 block truncate max-w-md">{r.title}</Link>
                      <div className="text-xs text-ink-500 mt-0.5">by {r.createdBy?.fullName ?? r.createdByName ?? r.createdById}</div>
                    </TD>
                    <TD><StatusPill status={r.status} /></TD>
                    <TD className="text-xs">{formatDate(r.deadline)}</TD>
                    <TD className="text-xs">{r._count?.quotations ?? r.quotationCount ?? 0}</TD>
                    <TD className="text-xs text-ink-500">{fromNow(r.createdAt)}</TD>
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
