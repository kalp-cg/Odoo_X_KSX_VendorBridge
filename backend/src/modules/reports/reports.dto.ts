import { z } from 'zod';

export const ReportQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  vendorId: z.string().uuid().optional(),
});
export type ReportQueryDto = z.infer<typeof ReportQuerySchema>;
