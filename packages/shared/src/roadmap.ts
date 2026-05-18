import { z } from 'zod';
import { LinkSchema } from './link.js';

// 24-char lowercase hex — Mongo ObjectId. Reused for all id-shaped fields
// across the roadmap surface so malformed values are rejected at the boundary
// instead of triggering a Mongoose CastError → 500 (same rule as
// LoginRequestSchema.userId).
const ObjectIdString = z.string().regex(/^[a-f\d]{24}$/i);

export const StepSchema = z.object({
  _id: ObjectIdString,
  title: z.string().min(1),
  links: z.array(LinkSchema).default([]),
  completed: z.boolean().default(false),
  completedAt: z.coerce.date().optional(),
});

export type Step = z.infer<typeof StepSchema>;

export const MilestoneSchema = z.object({
  _id: ObjectIdString,
  title: z.string().min(1),
  description: z.string().optional(),
  deadline: z.coerce.date().optional(),
  steps: z.array(StepSchema).default([]),
  completedAt: z.coerce.date().optional(),
});

export type Milestone = z.infer<typeof MilestoneSchema>;

export const RoadmapSchema = z.object({
  _id: ObjectIdString,
  userId: ObjectIdString,
  title: z.string().min(1),
  description: z.string().optional(),
  deadline: z.coerce.date().optional(),
  archived: z.boolean().default(false),
  milestones: z.array(MilestoneSchema).default([]),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type Roadmap = z.infer<typeof RoadmapSchema>;

// Request shapes — narrow projections used by API validation and frontend forms.
export const CreateRoadmapRequestSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  deadline: z.coerce.date().optional(),
});
export type CreateRoadmapRequest = z.infer<typeof CreateRoadmapRequestSchema>;

export const UpdateRoadmapRequestSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  // Nullable so clients can clear it; undefined leaves it alone.
  deadline: z.coerce.date().nullable().optional(),
  archived: z.boolean().optional(),
});
export type UpdateRoadmapRequest = z.infer<typeof UpdateRoadmapRequestSchema>;

export const CreateMilestoneRequestSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  deadline: z.coerce.date().optional(),
});
export type CreateMilestoneRequest = z.infer<typeof CreateMilestoneRequestSchema>;

export const UpdateMilestoneRequestSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  deadline: z.coerce.date().nullable().optional(),
});
export type UpdateMilestoneRequest = z.infer<typeof UpdateMilestoneRequestSchema>;

export const CreateStepRequestSchema = z.object({
  title: z.string().min(1),
  links: z.array(LinkSchema).optional(),
});
export type CreateStepRequest = z.infer<typeof CreateStepRequestSchema>;

export const UpdateStepRequestSchema = z.object({
  title: z.string().min(1).optional(),
  links: z.array(LinkSchema).optional(),
  completed: z.boolean().optional(),
});
export type UpdateStepRequest = z.infer<typeof UpdateStepRequestSchema>;

export const ReorderRequestSchema = z.object({
  ids: z.array(ObjectIdString).min(1),
});
export type ReorderRequest = z.infer<typeof ReorderRequestSchema>;

// Bulk import — accepts a full roadmap tree in a single request.
// Used by POST /api/roadmaps/bulk and the "Import from LLM" frontend flow.
// Field caps mirror single-item schemas where they exist; we add explicit
// max(200) on titles + max(2000) on descriptions so an LLM can't blow past
// reasonable bounds. The link URL is narrowed to http/https as defense in
// depth against javascript:/data: URLs in untrusted LLM output (the wider
// LinkSchema is intentionally permissive for backwards compat).
const BulkLinkSchema = z.object({
  url: z
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
    ),
  label: z.string().max(200).optional(),
});

export const BulkRoadmapRequestSchema = z.object({
  roadmap: z.object({
    title: z.string().min(1).max(200),
    description: z.string().max(2000).optional(),
    deadline: z.coerce.date().optional(),
  }),
  milestones: z
    .array(
      z.object({
        title: z.string().min(1).max(200),
        description: z.string().max(2000).optional(),
        deadline: z.coerce.date().optional(),
        steps: z
          .array(
            z.object({
              title: z.string().min(1).max(200),
              links: z.array(BulkLinkSchema).optional().default([]),
            })
          )
          .optional()
          .default([]),
      })
    )
    .min(1),
});

export type BulkRoadmapRequest = z.infer<typeof BulkRoadmapRequestSchema>;
