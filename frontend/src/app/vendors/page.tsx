'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { Plus, Search, MoreHorizontal, Building2 } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Button, Card, SearchInput, StatusPill, Pagination, Tabs, Table, THead, TBody, TR, TH, TD, EmptyState, useToast, Modal, Field, Input, Select, Textarea, Spinner } from '@/components/ui';
import { resources } from '@/lib/resources';
import type { Vendor, VendorStatus } from '@/lib/types';
import { fromNow } from '@/lib/utils';
import { extractError } from '@/lib/api';
import { useRequireAuth } from '@/hooks/useRequireAuth';

const STATUS_TABS: { key: 'ALL' | VendorStatus; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'PENDING_VERIFICATION', label: 'Pending' },
  { key: 'ACTIVE', label: 'Active' },
  { key: 'INACTIVE', label: 'Inactive' },
  { key: 'BLOCKED', label: 'Blocked' },
];

export default function VendorsPage() {
  useRequireAuth(['ADMIN', 'OFFICER', 'MANAGER']);
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState<'ALL' | VendorStatus>('ALL');
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['vendors', { page, tab, search }],
    queryFn: () =>
      resources.vendors.list({
        page,
        pageSize: 20,
        status: tab === 'ALL' ? undefined : tab,
        search: search || undefined,
      }),
  });

  return (
    <AppShell
      title="Vendors"
      subtitle="Manage your vendor companies and lifecycle"
      actions={
        <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>
          New Vendor
        </Button>
      }
    >
      <Card>
        <div className="flex flex-col md:flex-row gap-3 mb-4">
          <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search by legal name, GST, email…" className="md:w-80" />
        </div>
        <Tabs
          tabs={STATUS_TABS.map((t) => ({ key: t.key, label: t.label }))}
          value={tab}
          onChange={(k) => { setTab(k as 'ALL' | VendorStatus); setPage(1); }}
        />
        {isLoading ? (
          <div className="py-12 flex justify-center"><Spinner /></div>
        ) : !data?.data?.length ? (
          <EmptyState
            title="No vendors found"
            description="Try adjusting filters or create a new vendor."
            icon={<Building2 className="h-12 w-12" />}
            action={<Button onClick={() => setCreateOpen(true)} leftIcon={<Plus className="h-4 w-4" />}>New Vendor</Button>}
          />
        ) : (
          <>
            <Table>
              <THead>
                <TR>
                  <TH>Legal Name</TH>
                  <TH>GST</TH>
                  <TH>Category</TH>
                  <TH>Contact</TH>
                  <TH>Status</TH>
                  <TH>Created</TH>
                  <TH></TH>
                </TR>
              </THead>
              <TBody>
                {data!.data.map((v) => (
                  <TR key={v.id}>
                    <TD>
                      <Link href={`/vendors/${v.id}`} className="font-medium">{v.legalName}</Link>
                      <div className="text-xs text-ink-500">{v.displayName}</div>
                    </TD>
                    <TD className="font-mono text-xs">{v.gstNumber ?? '—'}</TD>
                    <TD>{v.category ?? '—'}</TD>
                    <TD>
                      <div className="text-xs">{v.contactEmail}</div>
                      {v.contactPhone && <div className="text-xs text-ink-500">{v.contactPhone}</div>}
                    </TD>
                    <TD><StatusPill status={v.status} /></TD>
                    <TD className="text-xs text-ink-500">{fromNow(v.createdAt)}</TD>
                    <TD className="text-right">
                      <Link href={`/vendors/${v.id}`} className="text-sm">View</Link>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            {data.pagination && (
              <div className="mt-4">
                <Pagination pagination={data.pagination} onPageChange={setPage} />
              </div>
            )}
          </>
        )}
      </Card>

      <CreateVendorModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </AppShell>
  );
}

function CreateVendorModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    legalName: '',
    displayName: '',
    contactEmail: '',
    contactPhone: '',
    gstNumber: '',
    panNumber: '',
    category: 'OTHER',
    addressLine1: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'India',
    notes: '',
  });

  const mutation = useMutation({
    mutationFn: () => resources.vendors.create(form),
    onSuccess: () => {
      toast.success('Vendor created', 'Vendor is pending verification.');
      qc.invalidateQueries({ queryKey: ['vendors'] });
      onClose();
    },
    onError: (err) => {
      toast.error('Could not create vendor', extractError(err).message);
    },
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New Vendor"
      description="Create a vendor company. Admin can later verify and activate."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>Cancel</Button>
          <Button onClick={() => mutation.mutate()} loading={mutation.isPending}>Create Vendor</Button>
        </>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Legal Name" required>
          <Input value={form.legalName} onChange={(e) => setForm({ ...form, legalName: e.target.value })} />
        </Field>
        <Field label="Display Name" required>
          <Input value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} />
        </Field>
        <Field label="Contact Email" required>
          <Input type="email" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} />
        </Field>
        <Field label="Contact Phone">
          <Input value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} />
        </Field>
        <Field label="GST Number">
          <Input value={form.gstNumber} onChange={(e) => setForm({ ...form, gstNumber: e.target.value })} />
        </Field>
        <Field label="PAN Number">
          <Input value={form.panNumber} onChange={(e) => setForm({ ...form, panNumber: e.target.value })} />
        </Field>
        <Field label="Category">
          <Select
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            options={[
              { value: 'MANUFACTURER', label: 'Manufacturer' },
              { value: 'DISTRIBUTOR', label: 'Distributor' },
              { value: 'SERVICE_PROVIDER', label: 'Service Provider' },
              { value: 'TRADER', label: 'Trader' },
              { value: 'OTHER', label: 'Other' },
            ]}
          />
        </Field>
        <Field label="Country">
          <Input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
        </Field>
        <Field label="Address" className="md:col-span-2">
          <Input value={form.addressLine1} onChange={(e) => setForm({ ...form, addressLine1: e.target.value })} />
        </Field>
        <Field label="City"><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></Field>
        <Field label="State"><Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} /></Field>
        <Field label="Postal Code"><Input value={form.postalCode} onChange={(e) => setForm({ ...form, postalCode: e.target.value })} /></Field>
        <Field label="Notes" className="md:col-span-2">
          <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </Field>
      </div>
    </Modal>
  );
}
