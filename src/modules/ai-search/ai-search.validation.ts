import { z } from 'zod';

export const smartSearchSchema = z.object({
  query: z.string().min(1).max(1024),
  type: z.enum(['text', 'link']).optional(),
  limit: z.number().int().min(1).max(50).optional(),
});

export type SmartSearchInput = z.infer<typeof smartSearchSchema>;
