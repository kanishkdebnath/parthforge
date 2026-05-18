import { z } from 'zod';
import { ObjectIdString } from './objectId.js';

export const JobApplicationStatusSchema = z.enum([
  'saved',
  'applied',
  'interviewing',
  'offer',
  'rejected',
  'withdrawn',
]);
export type JobApplicationStatus = z.infer<typeof JobApplicationStatusSchema>;

export const WorkModeSchema = z.enum(['remote', 'hybrid', 'onsite']);
export type WorkMode = z.infer<typeof WorkModeSchema>;

export const RoundOutcomeSchema = z.enum(['pending', 'passed', 'failed']);
export type RoundOutcome = z.infer<typeof RoundOutcomeSchema>;

// Mirrors the BulkLinkSchema refinement in roadmap.ts — defense against
// `javascript:` / `data:` URLs in pasted input. Inline here; lift into a
// shared helper if a third caller appears.
const HttpHttpsUrl = z
  .string()
  .url()
  .refine(
    (v) => {
      try {
        const u = new URL(v);
        return u.protocol === 'http:' || u.protocol === 'https:';
      } catch {
        return false;
      }
    },
    { message: 'URL must use http or https' }
  );

export const ContactSchema = z.object({
  _id: z.string(),
  name: z.string().min(1).max(200),
  role: z.string().max(200).optional(),
  email: z.string().email().optional(),
});
export type Contact = z.infer<typeof ContactSchema>;

export const InterviewRoundSchema = z.object({
  _id: z.string(),
  name: z.string().min(1).max(200),
  scheduledAt: z.coerce.date().optional(),
  durationMinutes: z.number().int().positive().max(24 * 60).optional(),
  interviewer: z.string().max(200).optional(),
  outcome: RoundOutcomeSchema.default('pending'),
  prepNotes: z.string().max(20_000).optional(),
  questions: z.array(z.string().min(1).max(2_000)).default([]),
  experience: z.string().max(20_000).optional(),
});
export type InterviewRound = z.infer<typeof InterviewRoundSchema>;

export const JobApplicationSchema = z.object({
  _id: z.string(),
  userId: z.string(),
  company: z.string().min(1).max(200),
  role: z.string().min(1).max(200),
  jobUrl: HttpHttpsUrl.optional(),
  status: JobApplicationStatusSchema.default('saved'),
  appliedAt: z.coerce.date().optional(),
  resumeUrl: HttpHttpsUrl.optional(),
  location: z.string().max(200).optional(),
  workMode: WorkModeSchema.optional(),
  salaryRange: z.string().max(200).optional(),
  offerAmount: z.string().max(200).optional(),
  tags: z.array(z.string().min(1).max(80)).default([]),
  notes: z.string().max(20_000).optional(),
  contacts: z.array(ContactSchema).default([]),
  rounds: z.array(InterviewRoundSchema).default([]),
  links: z
    .object({ roadmapId: ObjectIdString.optional() })
    .default({}),
  archived: z.boolean().default(false),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type JobApplication = z.infer<typeof JobApplicationSchema>;

// ---- Request shapes ----

// PATCH-friendly nullable for clearing optional dates (mirrors UpdateRoadmapRequestSchema).
const nullableDate = z.coerce.date().nullable().optional();

export const CreateJobApplicationRequestSchema = z.object({
  company: z.string().min(1).max(200),
  role: z.string().min(1).max(200),
  jobUrl: HttpHttpsUrl.optional(),
  status: JobApplicationStatusSchema.optional(),
  appliedAt: z.coerce.date().optional(),
  resumeUrl: HttpHttpsUrl.optional(),
  location: z.string().max(200).optional(),
  workMode: WorkModeSchema.optional(),
  salaryRange: z.string().max(200).optional(),
  offerAmount: z.string().max(200).optional(),
  tags: z.array(z.string().min(1).max(80)).optional(),
  notes: z.string().max(20_000).optional(),
  links: z.object({ roadmapId: ObjectIdString.optional() }).optional(),
});
export type CreateJobApplicationRequest = z.infer<
  typeof CreateJobApplicationRequestSchema
>;

export const UpdateJobApplicationRequestSchema = z.object({
  company: z.string().min(1).max(200).optional(),
  role: z.string().min(1).max(200).optional(),
  jobUrl: HttpHttpsUrl.nullable().optional(),
  status: JobApplicationStatusSchema.optional(),
  appliedAt: nullableDate,
  resumeUrl: HttpHttpsUrl.nullable().optional(),
  location: z.string().max(200).nullable().optional(),
  workMode: WorkModeSchema.nullable().optional(),
  salaryRange: z.string().max(200).nullable().optional(),
  offerAmount: z.string().max(200).nullable().optional(),
  tags: z.array(z.string().min(1).max(80)).optional(),
  notes: z.string().max(20_000).nullable().optional(),
  links: z
    .object({ roadmapId: ObjectIdString.nullable().optional() })
    .optional(),
  archived: z.boolean().optional(),
});
export type UpdateJobApplicationRequest = z.infer<
  typeof UpdateJobApplicationRequestSchema
>;

export const CreateRoundRequestSchema = z.object({
  name: z.string().min(1).max(200),
  scheduledAt: z.coerce.date().optional(),
  durationMinutes: z.number().int().positive().max(24 * 60).optional(),
  interviewer: z.string().max(200).optional(),
  outcome: RoundOutcomeSchema.optional(),
  prepNotes: z.string().max(20_000).optional(),
  questions: z.array(z.string().min(1).max(2_000)).optional(),
  experience: z.string().max(20_000).optional(),
});
export type CreateRoundRequest = z.infer<typeof CreateRoundRequestSchema>;

export const UpdateRoundRequestSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  scheduledAt: nullableDate,
  durationMinutes: z
    .number()
    .int()
    .positive()
    .max(24 * 60)
    .nullable()
    .optional(),
  interviewer: z.string().max(200).nullable().optional(),
  outcome: RoundOutcomeSchema.optional(),
  prepNotes: z.string().max(20_000).nullable().optional(),
  questions: z.array(z.string().min(1).max(2_000)).optional(),
  experience: z.string().max(20_000).nullable().optional(),
});
export type UpdateRoundRequest = z.infer<typeof UpdateRoundRequestSchema>;

export const CreateContactRequestSchema = z.object({
  name: z.string().min(1).max(200),
  role: z.string().max(200).optional(),
  email: z.string().email().optional(),
});
export type CreateContactRequest = z.infer<typeof CreateContactRequestSchema>;

export const UpdateContactRequestSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  role: z.string().max(200).nullable().optional(),
  email: z.string().email().nullable().optional(),
});
export type UpdateContactRequest = z.infer<typeof UpdateContactRequestSchema>;

// Re-export the roadmap-style reorder shape locally so the routes file imports
// from one place. Identical to ReorderRequestSchema in roadmap.ts.
export const ReorderRoundsRequestSchema = z.object({
  ids: z.array(ObjectIdString).min(1),
});
export type ReorderRoundsRequest = z.infer<typeof ReorderRoundsRequestSchema>;
