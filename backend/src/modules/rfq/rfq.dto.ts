import { z } from 'zod';

const LineItemInput = z.object({
  lineNo: z.number().int().positive().optional(),
  description: z.string().min(2).max(500),
  quantity: z.coerce.number().positive(),
  unit: z.string().min(1).max(32),
  targetUnitPrice: z.coerce.number().nonnegative().optional(),
  notes: z.string().max(500).optional(),
});

export const CreateRfqSchema = z.object({
  title: z.string().min(2).max(200),
  description: z.string().max(5000).optional(),
  deadline: z.coerce.date().refine((d) => d > new Date(), { message: 'deadline must be in the future' }),
  lineItems: z.array(LineItemInput).min(1, 'at least one line item is required'),
  vendorIds: z.array(z.string().uuid()).min(1, 'at least one vendor is required'),
});
export type CreateRfqDto = z.infer<typeof CreateRfqSchema>;

export const UpdateRfqSchema = z.object({
  title: z.string().min(2).max(200).optional(),
  description: z.string().max(5000).optional(),
  deadline: z.coerce.date().optional(),
  lineItems: z.array(LineItemInput).min(1).optional(),
  vendorIds: z.array(z.string().uuid()).min(1).optional(),
});
export type UpdateRfqDto = z.infer<typeof UpdateRfqSchema>;

export const ListRfqQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'CLOSED', 'CANCELLED']).optional(),
  search: z.string().max(200).optional(),
  // for vendors — auto-scopes to invitations
  scope: z.enum(['own', 'invited']).optional(),
});
export type ListRfqQueryDto = z.infer<typeof ListRfqQuerySchema>;

export const CancelRfqSchema = z.object({
  reason: z.string().min(2).max(500),
});
