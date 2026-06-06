import { z } from 'zod';
import { VendorStatus } from '@prisma/client';

const AddressSchema = z.object({
  addressLine1: z.string().max(200).optional(),
  addressLine2: z.string().max(200).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  postalCode: z.string().max(20).optional(),
  country: z.string().max(100).optional(),
});

export const CreateVendorSchema = z.object({
  legalName: z.string().min(2).max(200),
  displayName: z.string().min(2).max(200),
  gstNumber: z.string().max(32).optional(),
  panNumber: z.string().max(32).optional(),
  registrationNo: z.string().max(64).optional(),
  contactEmail: z.string().email().transform((v) => v.toLowerCase().trim()),
  contactPhone: z.string().max(32).optional(),
  category: z.string().max(100).optional(),
  notes: z.string().max(2000).optional(),
});
export const CreateVendorWithAddressSchema = CreateVendorSchema.merge(AddressSchema);
export type CreateVendorDto = z.infer<typeof CreateVendorWithAddressSchema>;

export const UpdateVendorSchema = CreateVendorWithAddressSchema.partial();
export type UpdateVendorDto = z.infer<typeof UpdateVendorSchema>;

export const ChangeVendorStatusSchema = z.object({
  status: z.nativeEnum(VendorStatus),
  reason: z.string().max(500).optional(),
});
export type ChangeVendorStatusDto = z.infer<typeof ChangeVendorStatusSchema>;

export const ListVendorsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
  status: z.nativeEnum(VendorStatus).optional(),
  category: z.string().max(100).optional(),
  search: z.string().max(200).optional(),
});
export type ListVendorsQueryDto = z.infer<typeof ListVendorsQuerySchema>;
