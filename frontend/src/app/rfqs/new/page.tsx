'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, ArrowLeft, Save, Send } from 'lucide-react';
import Link from 'next/link';
import { addDays, format } from 'date-fns';
import { AppShell } from '@/components/layout/AppShell';
import { Button, Card, Field, Input, Textarea, useToast, Spinner } from '@/components/ui';
import { resources } from '@/lib/resources';
import { extractError } from '@/lib/api';
import { useRequireAuth } from '@/hooks/useRequireAuth';

const lineItemSchema = z.object({
  description: z.string().min(2, 'Required'),
  quantity: z.coerce.number().positive('Must be > 0'),
  unit: z.string().min(1, 'Required'),
  targetUnitPrice: z.coerce.number().nonnegative().optional(),
});

const formSchema = z.object({
  title: z.string().min(2, 'Title is required'),
  description: z.string().optional(),
  deadline: z.string().min(1, 'Deadline required'),
  vendorIds: z.array(z.string()).min(1, 'At least one vendor required'),
  lineItems: z.array(lineItemSchema).min(1, 'At least one line item required'),
});

type FormValues = z.infer<typeof formSchema>;

export default function NewRfqPage() {
  useRequireAuth(['ADMIN', 'OFFICER']);
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const { data: vendors } = useQuery({
    queryKey: ['vendors-active'],
    queryFn: () => resources.vendors.list({ page: 1, pageSize: 100, status: 'ACTIVE' }),
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      description: '',
      deadline: format(addDays(new Date(), 14), "yyyy-MM-dd'T'HH:mm"),
      vendorIds: [],
      lineItems: [{ description: '', quantity: 1, unit: 'pcs', targetUnitPrice: 0 }],
    },
  });
  const { register, control, handleSubmit, formState, watch, setValue, getValues } = form;
  const { fields, append, remove } = useFieldArray({ control, name: 'lineItems' });
  const selectedVendorIds = watch('vendorIds') ?? [];

  const create = useMutation({
    mutationFn: (payload: FormValues) =>
      resources.rfqs.create({
        title: payload.title,
        description: payload.description,
        deadline: new Date(payload.deadline).toISOString(),
        lineItems: payload.lineItems.map((li, idx) => ({
          lineNo: idx + 1,
          description: li.description,
          quantity: Number(li.quantity),
          unit: li.unit,
          targetUnitPrice: li.targetUnitPrice ? Number(li.targetUnitPrice) : undefined,
        })),
        vendorIds: payload.vendorIds,
      }),
    onSuccess: (res) => {
      toast.success('RFQ created', `Draft ${res.data.number} created.`);
      qc.invalidateQueries({ queryKey: ['rfqs'] });
      router.push(`/rfqs/${res.data.id}`);
    },
    onError: (err) => {
      const e = extractError(err);
      toast.error('Could not create RFQ', e.message);
    },
  });

  const publish = useMutation({
    mutationFn: (id: string) => resources.rfqs.publish(id),
    onSuccess: () => {
      toast.success('RFQ published', 'Vendors have been notified.');
      qc.invalidateQueries({ queryKey: ['rfqs'] });
      router.push('/rfqs');
    },
    onError: (err) => toast.error('Could not publish', extractError(err).message),
  });

  async function onSave(values: FormValues, andPublish = false) {
    if (andPublish) {
      // Save then publish
      create.mutate(values, {
        onSuccess: (res) => publish.mutate(res.data.id),
      });
    } else {
      create.mutate(values);
    }
  }

  return (
    <AppShell
      title="New RFQ"
      subtitle="Create a draft and assign vendors"
      actions={
        <Link href="/rfqs" className="btn-secondary"><ArrowLeft className="h-4 w-4" />Back</Link>
      }
    >
      <div className="mb-4 flex items-center gap-2 text-sm">
        {[
          { n: 1, label: 'Basic Info' },
          { n: 2, label: 'Line Items' },
          { n: 3, label: 'Vendors' },
        ].map((s) => (
          <div key={s.n} className="flex items-center gap-2">
            <div className={`h-7 w-7 rounded-full grid place-items-center text-xs font-semibold ${step >= (s.n as 1 | 2 | 3) ? 'bg-brand-600 text-white' : 'bg-ink-200 text-ink-600'}`}>
              {s.n}
            </div>
            <span className={step === s.n ? 'font-medium text-ink-800' : 'text-ink-500'}>{s.label}</span>
            {s.n < 3 && <span className="text-ink-300">—</span>}
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit((v) => onSave(v, false))}>
        {step === 1 && (
          <Card>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Title" required error={formState.errors.title?.message} className="md:col-span-2">
                <Input {...register('title')} placeholder="e.g. Office Laptops Q3 2026" />
              </Field>
              <Field label="Description" className="md:col-span-2">
                <Textarea {...register('description')} placeholder="Optional context, specs, terms" />
              </Field>
              <Field label="Deadline" required error={formState.errors.deadline?.message}>
                <Input type="datetime-local" {...register('deadline')} />
              </Field>
            </div>
            <div className="mt-5 flex justify-end">
              <Button type="button" onClick={async () => { const ok = await form.trigger(['title', 'deadline']); if (ok) setStep(2); }}>
                Next
              </Button>
            </div>
          </Card>
        )}

        {step === 2 && (
          <Card>
            <h3 className="text-sm font-semibold text-ink-800 mb-3">Line Items</h3>
            <div className="space-y-2">
              {fields.map((f, idx) => (
                <div key={f.id} className="grid grid-cols-12 gap-2 items-start">
                  <div className="col-span-5">
                    <Input placeholder="Description" {...register(`lineItems.${idx}.description` as const)} />
                  </div>
                  <div className="col-span-2">
                    <Input type="number" step="0.01" placeholder="Qty" {...register(`lineItems.${idx}.quantity` as const)} />
                  </div>
                  <div className="col-span-2">
                    <Input placeholder="Unit" {...register(`lineItems.${idx}.unit` as const)} />
                  </div>
                  <div className="col-span-2">
                    <Input type="number" step="0.01" placeholder="Target ₹" {...register(`lineItems.${idx}.targetUnitPrice` as const)} />
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <button type="button" onClick={() => remove(idx)} className="text-red-500 hover:text-red-700 p-2" aria-label="Remove">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <Button type="button" variant="ghost" onClick={() => append({ description: '', quantity: 1, unit: 'pcs', targetUnitPrice: 0 })} leftIcon={<Plus className="h-4 w-4" />}>
              Add line
            </Button>

            <div className="mt-5 flex justify-between">
              <Button type="button" variant="secondary" onClick={() => setStep(1)}>Back</Button>
              <Button type="button" onClick={async () => { const ok = await form.trigger('lineItems'); if (ok) setStep(3); }}>Next</Button>
            </div>
          </Card>
        )}

        {step === 3 && (
          <Card>
            <h3 className="text-sm font-semibold text-ink-800 mb-1">Select Vendors</h3>
            <p className="text-xs text-ink-500 mb-3">Only ACTIVE vendors can be invited.</p>
            {!vendors ? (
              <div className="py-6 flex justify-center"><Spinner /></div>
            ) : (vendors.data.length === 0) ? (
              <div className="text-sm text-ink-500">No active vendors. <Link href="/vendors" className="text-brand-700">Create one</Link>.</div>
            ) : (
              <ul className="divide-y divide-ink-100 max-h-96 overflow-y-auto vb-scroll">
                {vendors.data.map((v) => {
                  const checked = selectedVendorIds.includes(v.id);
                  return (
                    <li key={v.id} className="flex items-center gap-3 py-2">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          const cur = getValues('vendorIds') ?? [];
                          setValue('vendorIds', e.target.checked ? [...cur, v.id] : cur.filter((x) => x !== v.id));
                        }}
                        className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-300"
                      />
                      <div>
                        <div className="text-sm font-medium text-ink-800">{v.legalName}</div>
                        <div className="text-xs text-ink-500">{v.contactEmail}{v.gstNumber ? ` · GST ${v.gstNumber}` : ''}</div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            {formState.errors.vendorIds && (
              <p className="text-xs text-red-600 mt-2">{formState.errors.vendorIds.message as string}</p>
            )}

            <div className="mt-5 flex flex-col sm:flex-row sm:justify-between gap-2">
              <Button type="button" variant="secondary" onClick={() => setStep(2)}>Back</Button>
              <div className="flex gap-2">
                <Button type="submit" leftIcon={<Save className="h-4 w-4" />} loading={create.isPending} disabled={publish.isPending}>
                  Save Draft
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  leftIcon={<Send className="h-4 w-4" />}
                  loading={publish.isPending}
                  onClick={async () => {
                    const ok = await form.trigger();
                    if (ok) handleSubmit((v) => onSave(v, true))();
                  }}
                >
                  Save & Publish
                </Button>
              </div>
            </div>
          </Card>
        )}
      </form>
    </AppShell>
  );
}
