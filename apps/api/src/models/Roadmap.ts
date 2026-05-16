import { Schema, model, type InferSchemaType, Types } from 'mongoose';

const linkSchema = new Schema(
  {
    url: { type: String, required: true },
    label: String,
  },
  { _id: false }
);

const stepSchema = new Schema(
  {
    title: { type: String, required: true },
    links: { type: [linkSchema], default: [] },
    completed: { type: Boolean, default: false },
    completedAt: Date,
  },
  { _id: true }
);

const milestoneSchema = new Schema(
  {
    title: { type: String, required: true },
    description: String,
    deadline: Date,
    steps: { type: [stepSchema], default: [] },
    completedAt: Date,
  },
  { _id: true }
);

const roadmapSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true },
    description: String,
    deadline: Date,
    archived: { type: Boolean, default: false },
    milestones: { type: [milestoneSchema], default: [] },
  },
  { timestamps: true }
);

// Compound index for the dominant list query: find user's active (or archived)
// roadmaps. CLAUDE.md rule: every compound index starts with userId.
roadmapSchema.index({ userId: 1, archived: 1 });

// InferSchemaType does NOT surface timestamps even with `timestamps: true`, so
// declare them explicitly (same pattern as UserDoc in apps/api/src/models/User.ts).
export type RoadmapDoc = InferSchemaType<typeof roadmapSchema> & {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const RoadmapModel = model('Roadmap', roadmapSchema);
