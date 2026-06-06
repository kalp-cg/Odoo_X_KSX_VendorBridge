import { z } from 'zod';
import { UserRole } from '@prisma/client';

export const SignupSchema = z
  .object({
    email: z.string().email().max(200).transform((v) => v.toLowerCase().trim()),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(128)
      .regex(/[A-Z]/, 'Must contain an uppercase letter')
      .regex(/[a-z]/, 'Must contain a lowercase letter')
      .regex(/[0-9]/, 'Must contain a digit'),
    fullName: z.string().min(2).max(120).transform((v) => v.trim()),
    phone: z.string().min(7).max(32).optional(),
    role: z.nativeEnum(UserRole).optional(), // ignored unless caller is admin
    // For vendor self-signup
    vendorCompany: z
      .object({
        legalName: z.string().min(2).max(200),
        displayName: z.string().min(2).max(200),
        gstNumber: z.string().max(32).optional(),
        panNumber: z.string().max(32).optional(),
        contactPhone: z.string().max(32).optional(),
        addressLine1: z.string().max(200).optional(),
        addressLine2: z.string().max(200).optional(),
        city: z.string().max(100).optional(),
        state: z.string().max(100).optional(),
        postalCode: z.string().max(20).optional(),
        country: z.string().max(100).optional(),
        category: z.string().max(100).optional(),
      })
      .optional(),
  })
  .refine((d) => d.role !== UserRole.VENDOR || !!d.vendorCompany, {
    message: 'vendorCompany is required when role=VENDOR',
    path: ['vendorCompany'],
  });

export type SignupDto = z.infer<typeof SignupSchema>;

export const LoginSchema = z.object({
  email: z.string().email().transform((v) => v.toLowerCase().trim()),
  password: z.string().min(1).max(200),
});
export type LoginDto = z.infer<typeof LoginSchema>;

export const RefreshSchema = z.object({
  refreshToken: z.string().min(20).max(2000),
});
export type RefreshDto = z.infer<typeof RefreshSchema>;

export const ForgotPasswordSchema = z.object({
  email: z.string().email().transform((v) => v.toLowerCase().trim()),
});
export type ForgotPasswordDto = z.infer<typeof ForgotPasswordSchema>;

export const ResetPasswordSchema = z.object({
  token: z.string().min(20).max(2000),
  newPassword: z
    .string()
    .min(8)
    .max(128)
    .regex(/[A-Z]/)
    .regex(/[a-z]/)
    .regex(/[0-9]/),
});
export type ResetPasswordDto = z.infer<typeof ResetPasswordSchema>;

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z
    .string()
    .min(8)
    .max(128)
    .regex(/[A-Z]/)
    .regex(/[a-z]/)
    .regex(/[0-9]/),
});
export type ChangePasswordDto = z.infer<typeof ChangePasswordSchema>;
