'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { Send, Truck, FileDown, Printer, Mail, Search } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Button, Card, StatusPill, Pagination, Tabs, Table, THead, TBody, TR, TH, TD, Spinner, useToast } from '@/components/ui';
import { resources, pdfUrl } from '@/lib/resources';
import type { PoStatus } from '@/lib/types';
import { fromNow, formatCurrency, formatDate } from '@/lib/utils';
import { extractError } from '@/lib/api';
import { useRequireAuth } from '@/hooks/useRequireAuth';

const TABS: { key: 'ALL' | PoStatus; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'GENERATED', label: 'Generated' },
  { key: 'SENT', label: 'Sent' },
  { key: 'DELIVERED', label: 'Delivered' },
];

export default function PurchaseOrdersPage() {
  useRequireAuth();
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState<'ALL' | PoStatus>('ALL');
  const toast = useToast();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['pos', { page, tab }],
    queryFn: () => resources.purchaseOrders.list({ page, pageSize: 20, status: tab === 'ALL' ? undefined : tab }),
  });

  const markSent = useMutation({
    mutationFn: (id: string) => resources.purchaseOrders.markSent(id),
    onSuccess: () => { toast.success('Marked as sent'); qc.invalidateQueries({ queryKey: ['pos'] }); },
    onError: (err) => toast.error('Failed', extractError(err).message),
  });
  const markDelivered = useMutation({
    mutationFn: (id: string) => resources.purchaseOrders.markDelivered(id),
    onSuccess: () => { toast.success('Marked as delivered'); qc.invalidateQueries({ queryKey: ['pos'] }); },
    onError: (err) => toast.error('Failed', extractError(err).message),
  });

  return (
    <AppShell title="Purchase Orders" subtitle="Generated from approved quotations">
      <Card>
        <Tabs tabs={TABS} value={tab} onChange={(k) => { setTab(k as 'ALL' | PoStatus); setPage(1); }} />
        {isLoading ? (
          <div className="py-12 flex justify-center"><Spinner /></div>
        ) : (
          <>
            <Table>
              <THead>
                <TR>
                  <TH>Number</TH>
                  <TH>Vendor</TH>
                  <TH>Status</TH>
                  <TH className="text-right">Total</TH>
                  <TH>Generated</TH>
                  <TH>Actions</TH>
                </TR>
              </THead>
              <TBody>
                {data?.data?.map((p: any) => (
                  <TR key={p.id}>
                    <TD className="font-mono text-xs"><Link href={`/purchase-orders/${p.id}`} className="text-brand-700">{p.number}</Link></TD>
                    <TD>{p.vendor?.displayName ?? p.vendorName ?? p.vendorId}</TD>
                    <TD><StatusPill status={p.status} /></TD>
                    <TD className="text-right">{formatCurrency(Number(p.grandTotal))}</TD>
                    <TD className="text-xs text-ink-500">{fromNow(p.generatedAt)}</TD>
                    <TD>
                      <div className="flex items-center gap-1">
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
                        }} className="text-ink-500 hover:text-brand-600 p-1" title="PDF">
                          <FileDown className="h-4 w-4" />
                        </button>
                        {p.status === 'GENERATED' && (
                          <Button size="sm" variant="ghost" leftIcon={<Send className="h-3.5 w-3.5" />} loading={markSent.isPending && markSent.variables === p.id} onClick={() => markSent.mutate(p.id)}>
                            Send
                          </Button>
                        )}
                        {p.status === 'SENT' && (
                          <Button size="sm" variant="ghost" leftIcon={<Truck className="h-3.5 w-3.5" />} loading={markDelivered.isPending && markDelivered.variables === p.id} onClick={() => markDelivered.mutate(p.id)}>
                            Delivered
                          </Button>
                        )}
                      </div>
                    </TD>
                  </TR>
                ))}
                {data?.data?.length === 0 && <TR><TD colSpan={6} className="text-center py-6 text-ink-500">No purchase orders.</TD></TR>}
              </TBody>
            </Table>
            {data?.pagination && <div className="mt-4"><Pagination pagination={data.pagination} onPageChange={setPage} /></div>}
          </>
        )}
      </Card>
    </AppShell>
  );
}
