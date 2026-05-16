import { z } from 'zod';

export const UserSchema = z.object({
  _id: z.string(),
  email: z.string().email(),
  name: z.string().min(1),
  avatarUrl: z.string().url().optional(),
  googleId: z.string().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type User = z.infer<typeof UserSchema>;

export const LoginRequestSchema = z.object({
  userId: z.string().min(1),
});

export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const DevUserSchema = UserSchema.pick({
  _id: true,
  email: true,
  name: true,
  avatarUrl: true,
});

export type DevUser = z.infer<typeof DevUserSchema>;
