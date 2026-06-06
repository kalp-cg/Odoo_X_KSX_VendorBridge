'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { Bell, CheckCheck, Inbox } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Card, Spinner, EmptyState, Button, useToast, Pagination } from '@/components/ui';
import { resources } from '@/lib/resources';
import { fromNow } from '@/lib/utils';
import { extractError } from '@/lib/api';
import { useRequireAuth } from '@/hooks/useRequireAuth';

const TONE: Record<string, string> = {
  RFQ_PUBLISHED: 'bg-blue-100 text-blue-700',
  RFQ_CLOSED: 'bg-ink-200 text-ink-700',
  QUOTATION_SUBMITTED: 'bg-violet-100 text-violet-700',
  QUOTATION_SHORTLISTED: 'bg-violet-100 text-violet-700',
  APPROVAL_REQUESTED: 'bg-amber-100 text-amber-700',
  APPROVAL_APPROVED: 'bg-emerald-100 text-emerald-700',
  APPROVAL_REJECTED: 'bg-red-100 text-red-700',
  PO_GENERATED: 'bg-ink-200 text-ink-700',
  PO_SENT: 'bg-blue-100 text-blue-700',
  PO_DELIVERED: 'bg-emerald-100 text-emerald-700',
  INVOICE_GENERATED: 'bg-ink-200 text-ink-700',
  INVOICE_PAID: 'bg-emerald-100 text-emerald-700',
  INVOICE_OVERDUE: 'bg-red-100 text-red-700',
  VENDOR_VERIFIED: 'bg-emerald-100 text-emerald-700',
  VENDOR_BLOCKED: 'bg-red-100 text-red-700',
  SYSTEM: 'bg-ink-200 text-ink-700',
};

function linkFor(n: { entityType?: string | null; entityId?: string | null }): string | null {
  if (!n.entityType || !n.entityId) return null;
  switch (n.entityType) {
    case 'RFQ': return `/rfqs/${n.entityId}`;
    case 'QUOTATION': return `/quotations/${n.entityId}`;
    case 'PURCHASE_ORDER': return `/purchase-orders/${n.entityId}`;
    case 'INVOICE': return `/invoices/${n.entityId}`;
    case 'VENDOR': return `/vendors/${n.entityId}`;
    case 'APPROVAL': return `/approvals`;
    default: return null;
  }
}

export default function NotificationsPage() {
  useRequireAuth();
  const [page, setPage] = useState(1);
  const toast = useToast();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['notifications', page],
    queryFn: () => resources.notifications.list({ page, pageSize: 20 }),
  });

  const markAll = useMutation({
    mutationFn: () => resources.notifications.markAllRead(),
    onSuccess: () => { toast.success('All marked as read'); qc.invalidateQueries({ queryKey: ['notifications'] }); },
    onError: (err) => toast.error('Failed', extractError(err).message),
  });
  const markOne = useMutation({
    mutationFn: (id: string) => resources.notifications.markRead([id]),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  return (
    <AppShell
      title="Notifications"
      subtitle="In-app alerts and updates"
      actions={<Button variant="secondary" leftIcon={<CheckCheck className="h-4 w-4" />} onClick={() => markAll.mutate()} loading={markAll.isPending}>Mark all read</Button>}
    >
      <Card>
        {isLoading ? (
          <div className="py-12 flex justify-center"><Spinner /></div>
        ) : !data?.data?.length ? (
          <EmptyState title="No notifications" description="You're all caught up." icon={<Inbox className="h-12 w-12" />} />
        ) : (
          <ul className="divide-y divide-ink-100">
            {data.data.map((n) => {
              const href = linkFor(n);
              const unread = n.status === 'UNREAD';
              const tone = TONE[n.type] ?? TONE.SYSTEM;
              return (
                <li key={n.id} className={`py-3 flex items-start gap-3 ${unread ? 'bg-brand-50/40 -mx-2 px-2 rounded-lg' : ''}`}>
                  <div className={`h-8 w-8 rounded-lg grid place-items-center text-xs font-semibold ${tone}`}>
                    <Bell className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-ink-800 truncate">{n.title}</span>
                      {unread && <span className="h-2 w-2 rounded-full bg-brand-500" />}
                    </div>
                    <p className="text-xs text-ink-600 mt-0.5">{n.message}</p>
                    <div className="text-[10px] text-ink-500 mt-0.5">{fromNow(n.createdAt)}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {href && <Link href={href} className="text-xs">View</Link>}
                    {unread && <button onClick={() => markOne.mutate(n.id)} className="text-xs text-ink-500 hover:text-ink-800">Mark read</button>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {data?.pagination && <div className="mt-4"><Pagination pagination={data.pagination} onPageChange={setPage} /></div>}
      </Card>
    </AppShell>
  );
}
