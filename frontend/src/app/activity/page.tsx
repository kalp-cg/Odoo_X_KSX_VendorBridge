'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Download, Activity, Filter } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Card, CardHeader, SearchInput, Tabs, Table, THead, TBody, TR, TH, TD, Spinner, Button, useToast, EmptyState, Pagination } from '@/components/ui';
import { resources, csvUrl } from '@/lib/resources';
import { fromNow, formatDateTime } from '@/lib/utils';
import { useRequireAuth } from '@/hooks/useRequireAuth';

const ENTITY_TABS = [
  { key: 'ALL', label: 'All' },
  { key: 'VENDOR', label: 'Vendors' },
  { key: 'RFQ', label: 'RFQs' },
  { key: 'QUOTATION', label: 'Quotations' },
  { key: 'APPROVAL', label: 'Approvals' },
  { key: 'PURCHASE_ORDER', label: 'POs' },
  { key: 'INVOICE', label: 'Invoices' },
  { key: 'AUTH', label: 'Auth' },
];

export default function ActivityPage() {
  useRequireAuth();
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState('ALL');
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['audit', { page, tab }],
    queryFn: () =>
      resources.audit.list({
        page,
        pageSize: 30,
        entityType: tab === 'ALL' ? undefined : (tab as 'VENDOR' | 'RFQ' | 'QUOTATION' | 'APPROVAL' | 'PURCHASE_ORDER' | 'INVOICE' | 'AUTH'),
      }),
  });

  return (
    <AppShell title="Activity" subtitle="Immutable audit trail of every critical action">
      <Card>
        <CardHeader
          title="Audit Timeline"
          icon={<Activity className="h-4 w-4" />}
          action={
            <a
              href={csvUrl('/audit-logs/export.csv', { entityType: tab === 'ALL' ? undefined : tab })}
              className="btn-ghost"
            >
              <Download className="h-4 w-4" />Export CSV
            </a>
          }
        />
        <div className="mb-3">
          <Tabs tabs={ENTITY_TABS} value={tab} onChange={(k) => { setTab(k); setPage(1); }} />
        </div>
        {isLoading ? (
          <div className="py-12 flex justify-center"><Spinner /></div>
        ) : !data?.data?.length ? (
          <EmptyState title="No activity" description="No audit records match your filter." />
        ) : (
          <>
            <Table>
              <THead>
                <TR>
                  <TH>When</TH>
                  <TH>Actor</TH>
                  <TH>Action</TH>
                  <TH>Entity</TH>
                  <TH>Description</TH>
                </TR>
              </THead>
              <TBody>
                {data!.data.map((row) => (
                  <TR key={String(row.id)}>
                    <TD className="whitespace-nowrap">
                      <div className="text-xs text-ink-800">{formatDateTime(row.occurredAt)}</div>
                      <div className="text-[10px] text-ink-500">{fromNow(row.occurredAt)}</div>
                    </TD>
                    <TD>
                      <div className="text-xs">{row.actor?.email ?? row.actorEmail ?? '—'}</div>
                      {row.actor?.role && <div className="text-[10px] text-ink-500">{row.actor.role}</div>}
                    </TD>
                    <TD><span className="font-mono text-[11px] px-2 py-0.5 rounded bg-ink-100">{row.action}</span></TD>
                    <TD className="text-xs">{row.entityType}{row.entityId ? ` · ${String(row.entityId).slice(0, 8)}…` : ''}</TD>
                    <TD className="text-xs">{row.description ?? '—'}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            {data.pagination && <div className="mt-4"><Pagination pagination={data.pagination} onPageChange={setPage} /></div>}
          </>
        )}
      </Card>
    </AppShell>
  );
}
