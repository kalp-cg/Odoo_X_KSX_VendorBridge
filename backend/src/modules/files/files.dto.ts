import { z } from 'zod';
import { FileOwnerType, FileVisibility } from '@prisma/client';

export const InitUploadSchema = z.object({
  ownerType: z.nativeEnum(FileOwnerType),
  ownerId: z.string().uuid().optional(),
  visibility: z.nativeEnum(FileVisibility).default(FileVisibility.PRIVATE),
  filename: z.string().min(1).max(255),
  mimeType: z.string().min(3).max(120),
});
export type InitUploadDto = z.infer<typeof InitUploadSchema>;

export const ListFilesQuerySchema = z.object({
  ownerType: z.nativeEnum(FileOwnerType).optional(),
  ownerId: z.string().uuid().optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
});
export type ListFilesQueryDto = z.infer<typeof ListFilesQuerySchema>;
