import { z } from 'zod';
import { UserRole, UserStatus } from '@prisma/client';

export const CreateUserSchema = z.object({
  email: z.string().email().transform((v) => v.toLowerCase().trim()),
  fullName: z.string().min(2).max(120).transform((v) => v.trim()),
  phone: z.string().min(7).max(32).optional(),
  role: z.nativeEnum(UserRole),
  status: z.nativeEnum(UserStatus).default(UserStatus.ACTIVE),
  password: z
    .string()
    .min(8)
    .max(128)
    .regex(/[A-Z]/)
    .regex(/[a-z]/)
    .regex(/[0-9]/),
  vendorCompanyId: z.string().uuid().optional(),
});
export type CreateUserDto = z.infer<typeof CreateUserSchema>;

export const UpdateUserSchema = z.object({
  fullName: z.string().min(2).max(120).optional(),
  phone: z.string().min(7).max(32).optional(),
});
export type UpdateUserDto = z.infer<typeof UpdateUserSchema>;

export const ChangeRoleSchema = z.object({
  role: z.nativeEnum(UserRole),
});
export type ChangeRoleDto = z.infer<typeof ChangeRoleSchema>;

export const ChangeStatusSchema = z.object({
  status: z.nativeEnum(UserStatus),
  reason: z.string().max(500).optional(),
});
export type ChangeStatusDto = z.infer<typeof ChangeStatusSchema>;

export const ListUsersQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
  role: z.nativeEnum(UserRole).optional(),
  status: z.nativeEnum(UserStatus).optional(),
  search: z.string().max(200).optional(),
});
export type ListUsersQueryDto = z.infer<typeof ListUsersQuerySchema>;
