import { z } from 'zod';
import { PaymentMethod } from '@prisma/client';

export const ListInvoicesQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
  status: z.enum(['PENDING', 'PAID', 'OVERDUE']).optional(),
  vendorId: z.string().uuid().optional(),
});
export type ListInvoicesQueryDto = z.infer<typeof ListInvoicesQuerySchema>;

export const MarkPaidSchema = z.object({
  payment: z.object({
    amount: z.coerce.number().positive(),
    method: z.nativeEnum(PaymentMethod),
    reference: z.string().max(200).optional(),
    notes: z.string().max(500).optional(),
  }),
});
export type MarkPaidDto = z.infer<typeof MarkPaidSchema>;
