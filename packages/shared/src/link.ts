import { z } from 'zod';

export const LinkSchema = z.object({
  url: z.string().url(),
  label: z.string().optional(),
});

export type Link = z.infer<typeof LinkSchema>;
