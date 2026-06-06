import { z } from 'zod';

const LineItemInput = z.object({
  rfqLineItemId: z.string().uuid(),
  unitPrice: z.coerce.number().nonnegative(),
  quantity: z.coerce.number().positive(),
  notes: z.string().max(500).optional(),
});

export const SubmitQuotationSchema = z.object({
  rfqId: z.string().uuid(),
  // For vendors: derived from their vendorCompanyId. For officer override: pass explicitly.
  vendorId: z.string().uuid().optional(),
  lineItems: z.array(LineItemInput).min(1),
  deliveryDate: z.coerce.date().optional(),
  notes: z.string().max(2000).optional(),
});
export type SubmitQuotationDto = z.infer<typeof SubmitQuotationSchema>;

export const UpdateQuotationSchema = z.object({
  lineItems: z.array(LineItemInput).min(1).optional(),
  deliveryDate: z.coerce.date().optional(),
  notes: z.string().max(2000).optional(),
});
export type UpdateQuotationDto = z.infer<typeof UpdateQuotationSchema>;

export const ListQuotationsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
  rfqId: z.string().uuid().optional(),
  status: z.enum(['SUBMITTED', 'SHORTLISTED', 'ACCEPTED', 'REJECTED']).optional(),
});
export type ListQuotationsQueryDto = z.infer<typeof ListQuotationsQuerySchema>;
