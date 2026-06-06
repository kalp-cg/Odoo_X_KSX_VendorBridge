import { z } from 'zod';

export const RejectApprovalSchema = z.object({
  remarks: z.string().min(3, 'remarks are required when rejecting').max(2000),
});

export const ListApprovalsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
});
export type ListApprovalsQueryDto = z.infer<typeof ListApprovalsQuerySchema>;
