'use client';

import { use, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { Building2, ArrowLeft, CheckCircle2, XCircle, Ban, MapPin, Mail, Phone } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Button, Card, CardHeader, StatusPill, Spinner, useToast, Modal, Field, Input, Textarea } from '@/components/ui';
import { resources } from '@/lib/resources';
import { formatDate, formatNumber } from '@/lib/utils';
import type { VendorStatus } from '@/lib/types';
import { extractError } from '@/lib/api';
import { useRequireAuth } from '@/hooks/useRequireAuth';

export default function VendorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  useRequireAuth(['ADMIN', 'OFFICER', 'MANAGER']);
  const toast = useToast();
  const qc = useQueryClient();
  const [statusOpen, setStatusOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [targetStatus, setTargetStatus] = useState<VendorStatus>('ACTIVE');

  const { data, isLoading } = useQuery({
    queryKey: ['vendor', id],
    queryFn: () => resources.vendors.get(id),
  });

  const changeStatus = useMutation({
    mutationFn: () => resources.vendors.changeStatus(id, { status: targetStatus, reason: reason || undefined }),
    onSuccess: () => {
      toast.success('Status updated', `Vendor is now ${targetStatus}.`);
      qc.invalidateQueries({ queryKey: ['vendor', id] });
      qc.invalidateQueries({ queryKey: ['vendors'] });
      setStatusOpen(false);
      setReason('');
    },
    onError: (err) => toast.error('Could not update', extractError(err).message),
  });

  if (isLoading || !data?.data) {
    return <AppShell title="Vendor"><Spinner /></AppShell>;
  }
  const v = data.data;

  return (
    <AppShell
      title={v.legalName}
      subtitle={v.displayName}
      actions={
        <div className="flex gap-2">
          <Link href="/vendors" className="btn-secondary"><ArrowLeft className="h-4 w-4" />Back</Link>
          {v.status === 'PENDING_VERIFICATION' && (
            <Button onClick={() => { setTargetStatus('ACTIVE'); setStatusOpen(true); }} leftIcon={<CheckCircle2 className="h-4 w-4" />}>Verify & Activate</Button>
          )}
          {v.status === 'ACTIVE' && (
            <Button variant="secondary" onClick={() => { setTargetStatus('INACTIVE'); setStatusOpen(true); }} leftIcon={<Ban className="h-4 w-4" />}>Deactivate</Button>
          )}
          {v.status !== 'BLOCKED' && v.status !== 'PENDING_VERIFICATION' && (
            <Button variant="danger" onClick={() => { setTargetStatus('BLOCKED'); setStatusOpen(true); }} leftIcon={<XCircle className="h-4 w-4" />}>Block</Button>
          )}
        </div>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader title="Company Details" />
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-y-3 gap-x-6 text-sm">
            <FieldRow label="Legal Name" value={v.legalName} />
            <FieldRow label="Display Name" value={v.displayName} />
            <FieldRow label="GST" value={v.gstNumber} mono />
            <FieldRow label="PAN" value={v.panNumber} mono />
            <FieldRow label="Category" value={v.category} />
            <FieldRow label="Rating" value={v.rating != null ? formatNumber(Number(v.rating), 2) : null} />
            <FieldRow label="Status" value={<StatusPill status={v.status} />} />
            <FieldRow label="Created" value={formatDate(v.createdAt)} />
          </dl>
        </Card>

        <Card>
          <CardHeader title="Contact" icon={<Mail className="h-4 w-4" />} />
          <ul className="space-y-2 text-sm">
            <li className="flex items-center gap-2"><Mail className="h-4 w-4 text-ink-400" />{v.contactEmail}</li>
            {v.contactPhone && <li className="flex items-center gap-2"><Phone className="h-4 w-4 text-ink-400" />{v.contactPhone}</li>}
            {v.addressLine1 && (
              <li className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-ink-400 mt-0.5" />
                <div>
                  <div>{v.addressLine1}</div>
                  {v.addressLine2 && <div>{v.addressLine2}</div>}
                  <div className="text-ink-500 text-xs">
                    {[v.city, v.state, v.postalCode].filter(Boolean).join(', ')}
                    {v.country ? ` · ${v.country}` : ''}
                  </div>
                </div>
              </li>
            )}
          </ul>
        </Card>

        {v.notes && (
          <Card className="lg:col-span-3">
            <CardHeader title="Notes" icon={<Building2 className="h-4 w-4" />} />
            <p className="text-sm text-ink-700 whitespace-pre-wrap">{v.notes}</p>
          </Card>
        )}
      </div>

      <Modal
        open={statusOpen}
        onClose={() => setStatusOpen(false)}
        title={`Change status to ${targetStatus}`}
        description="Provide a reason. This action is logged in the audit trail."
        footer={
          <>
            <Button variant="secondary" onClick={() => setStatusOpen(false)}>Cancel</Button>
            <Button variant={targetStatus === 'BLOCKED' ? 'danger' : 'primary'} loading={changeStatus.isPending} onClick={() => changeStatus.mutate()}>
              Confirm
            </Button>
          </>
        }
      >
        <Field label="Reason (optional)">
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Internal note for the audit log" />
        </Field>
      </Modal>
    </AppShell>
  );
}

function FieldRow({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <dt className="label">{label}</dt>
      <dd className={`mt-0.5 text-ink-800 ${mono ? 'font-mono text-xs' : ''}`}>{value ?? '—'}</dd>
    </div>
  );
}
