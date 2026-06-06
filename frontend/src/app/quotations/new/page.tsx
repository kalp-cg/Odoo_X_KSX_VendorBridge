'use client';

import { Suspense, use, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Save, Send } from 'lucide-react';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import { Button, Card, CardHeader, Field, Input, Textarea, Spinner, useToast } from '@/components/ui';
import { resources } from '@/lib/resources';
import { formatCurrency } from '@/lib/utils';
import { extractError } from '@/lib/api';
import { useRequireAuth } from '@/hooks/useRequireAuth';

const schema = z.object({
  notes: z.string().optional(),
  deliveryDate: z.string().optional(),
  lineItems: z.array(
    z.object({
      rfqLineItemId: z.string().uuid(),
      unitPrice: z.coerce.number().nonnegative('Must be ≥ 0'),
      quantity: z.coerce.number().positive('Must be > 0'),
    }),
  ),
});

type FormValues = z.infer<typeof schema>;

function NewQuotationInner() {
  const router = useRouter();
  const params = useSearchParams();
  const rfqId = params.get('rfqId') ?? '';
  useRequireAuth(['VENDOR']);
  const toast = useToast();
  const qc = useQueryClient();

  const { data: rfq, isLoading } = useQuery({
    queryKey: ['rfq', rfqId],
    queryFn: () => resources.rfqs.get(rfqId),
    enabled: !!rfqId,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { notes: '', deliveryDate: '', lineItems: [] },
  });
  const { control, register, handleSubmit, formState, watch, reset } = form;
  const { fields } = useFieldArray({ control, name: 'lineItems' });

  useEffect(() => {
    if (rfq?.data?.lineItems) {
      reset({
        notes: '',
        deliveryDate: '',
        lineItems: rfq.data.lineItems.map((li) => ({
          rfqLineItemId: li.id,
          unitPrice: 0,
          quantity: Number(li.quantity),
        })),
      });
    }
  }, [rfq, reset]);

  const lineItems = watch('lineItems') ?? [];
  const subtotal = lineItems.reduce((acc, li) => acc + (Number(li.unitPrice) || 0) * (Number(li.quantity) || 0), 0);

  const submit = useMutation({
    mutationFn: (v: FormValues) =>
      resources.quotations.create({
        rfqId,
        notes: v.notes,
        deliveryDate: v.deliveryDate ? new Date(v.deliveryDate).toISOString() : undefined,
        lineItems: v.lineItems.map((li) => ({
          rfqLineItemId: li.rfqLineItemId,
          unitPrice: Number(li.unitPrice),
          quantity: Number(li.quantity),
        })),
      }),
    onSuccess: (res) => {
      toast.success('Quotation submitted', res.data.number);
      qc.invalidateQueries({ queryKey: ['quotations'] });
      router.push(`/quotations/${res.data.id}`);
    },
    onError: (err) => toast.error('Could not submit', extractError(err).message),
  });

  if (!rfqId) {
    return (
      <AppShell title="New Quotation">
        <Card>
          <p className="text-sm text-ink-500">Please choose an RFQ from the list first.</p>
          <div className="mt-3"><Link href="/rfqs" className="btn-primary">Browse RFQs</Link></div>
        </Card>
      </AppShell>
    );
  }

  if (isLoading || !rfq?.data) {
    return <AppShell title="New Quotation"><Spinner /></AppShell>;
  }

  return (
    <AppShell
      title={`New Quotation — ${rfq.data.number}`}
      subtitle={rfq.data.title}
      actions={<Link href="/rfqs" className="btn-secondary"><ArrowLeft className="h-4 w-4" />Back</Link>}
    >
      <form onSubmit={handleSubmit((v) => submit.mutate(v))} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader title="Line Items" description="Quote your unit price for each line. Quantity is pre-filled from the RFQ." />
            {fields.length === 0 ? (
              <p className="text-sm text-ink-500">This RFQ has no line items.</p>
            ) : (
              <div className="space-y-2">
                {fields.map((f, idx) => {
                  const rfqLi = rfq.data!.lineItems!.find((x) => x.id === f.rfqLineItemId);
                  const total = (Number(watch(`lineItems.${idx}.unitPrice`)) || 0) * (Number(watch(`lineItems.${idx}.quantity`)) || 0);
                  return (
                    <div key={f.id} className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-5">
                        <div className="text-sm font-medium text-ink-800">{rfqLi?.description}</div>
                        <div className="text-xs text-ink-500">RFQ qty: {String(rfqLi?.quantity)} {rfqLi?.unit}</div>
                      </div>
                      <div className="col-span-3">
                        <Input type="number" step="0.01" placeholder="Unit price" {...register(`lineItems.${idx}.unitPrice` as const)} />
                      </div>
                      <div className="col-span-2">
                        <Input type="number" step="0.01" {...register(`lineItems.${idx}.quantity` as const)} />
                      </div>
                      <div className="col-span-2 text-right text-sm font-medium">{formatCurrency(total)}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <Card>
            <CardHeader title="Details" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Delivery Date">
                <Input type="date" {...register('deliveryDate')} />
              </Field>
              <Field label="Notes" className="md:col-span-2">
                <Textarea {...register('notes')} placeholder="Any conditions, payment terms, etc." />
              </Field>
            </div>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader title="Summary" />
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span>Subtotal</span><span className="font-medium">{formatCurrency(subtotal)}</span></div>
              <div className="border-t border-ink-100 pt-2 flex justify-between text-base font-semibold">
                <span>Total</span><span>{formatCurrency(subtotal)}</span>
              </div>
            </div>
            <div className="mt-4">
              <Button type="submit" fullWidth leftIcon={<Send className="h-4 w-4" />} loading={submit.isPending}>
                Submit Quotation
              </Button>
            </div>
            {formState.errors.lineItems && (
              <p className="text-xs text-red-600 mt-2">{formState.errors.lineItems.message as string}</p>
            )}
          </Card>
        </div>
      </form>
    </AppShell>
  );
}

export default function NewQuotationPage() {
  return (
    <Suspense fallback={null}>
      <NewQuotationInner />
    </Suspense>
  );
}
