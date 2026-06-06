import { z } from 'zod';

export const ListPosQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
  status: z.enum(['GENERATED', 'SENT', 'DELIVERED']).optional(),
  vendorId: z.string().uuid().optional(),
});
export type ListPosQueryDto = z.infer<typeof ListPosQuerySchema>;

export const MarkSentSchema = z.object({
  note: z.string().max(500).optional(),
});
export const MarkDeliveredSchema = z.object({
  note: z.string().max(500).optional(),
});
