import { z } from 'zod';
import { LICENSE_STATUS } from '@/constants/license-status';

const objectIdSchema = z.string().regex(/^[a-fA-F0-9]{24}$/, 'Invalid id');

export const createLicenseRequestSchema = z.object({
  song: objectIdSchema,
  fullName: z.string().min(1).max(150),
  email: z.string().email(),
  companyName: z.string().max(150).optional(),
  projectName: z.string().max(150).optional(),
  usageType: z.string().min(1).max(100),
  usageDescription: z.string().max(2000).optional(),
  budget: z.coerce.number().nonnegative().optional(),
  message: z.string().max(2000).optional(),
});

export const updateLicenseStatusSchema = z.object({
  status: z.enum([
    LICENSE_STATUS.PENDING,
    LICENSE_STATUS.IN_REVIEW,
    LICENSE_STATUS.APPROVED,
    LICENSE_STATUS.REJECTED,
  ]),
  adminNote: z.string().max(2000).optional(),
});

export const licenseIdParamSchema = z.object({
  id: objectIdSchema,
});

export type CreateLicenseRequestInput = z.infer<
  typeof createLicenseRequestSchema
>;
export type UpdateLicenseStatusInput = z.infer<
  typeof updateLicenseStatusSchema
>;