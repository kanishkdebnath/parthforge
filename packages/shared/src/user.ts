import { z } from 'zod';

export const UserSchema = z.object({
  _id: z.string(),
  email: z.string().email(),
  name: z.string().min(1),
  avatarUrl: z.string().url().optional(),
  googleId: z.string().optional(),
  isDemoUser: z.boolean().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type User = z.infer<typeof UserSchema>;

export const LoginRequestSchema = z.object({
  // 24-char lowercase hex — Mongo ObjectId. Validates at the boundary so the
  // login route never hands a malformed value to Mongoose.findById.
  userId: z.string().regex(/^[a-f\d]{24}$/i),
  // Optional. The client's local YYYY-MM-DD at login time. Used by the demo
  // reset to anchor journal-day seeding to the user's local calendar instead
  // of the server's UTC day — otherwise users east of UTC see "day 0" land
  // on yesterday and the dashboard's "today" card stays empty.
  clientToday: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/)
    .optional(),
});

export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const DevUserSchema = UserSchema.pick({
  _id: true,
  email: true,
  name: true,
  avatarUrl: true,
  isDemoUser: true,
});

export type DevUser = z.infer<typeof DevUserSchema>;
