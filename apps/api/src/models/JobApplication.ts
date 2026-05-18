import { Schema, model, type InferSchemaType, Types } from 'mongoose';

const contactSchema = new Schema(
  {
    name: { type: String, required: true },
    role: String,
    email: String,
  },
  { _id: true }
);

const roundSchema = new Schema(
  {
    name: { type: String, required: true },
    scheduledAt: Date,
    durationMinutes: Number,
    interviewer: String,
    outcome: {
      type: String,
      enum: ['pending', 'passed', 'failed'],
      default: 'pending',
    },
    prepNotes: String,
    questions: { type: [String], default: [] },
    experience: String,
  },
  { _id: true }
);

const jobApplicationSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: 'User', required: true },
    company: { type: String, required: true },
    role: { type: String, required: true },
    jobUrl: String,
    status: {
      type: String,
      enum: ['saved', 'applied', 'interviewing', 'offer', 'rejected', 'withdrawn'],
      default: 'saved',
    },
    appliedAt: Date,
    resumeUrl: String,
    location: String,
    workMode: { type: String, enum: ['remote', 'hybrid', 'onsite'] },
    salaryRange: String,
    offerAmount: String,
    tags: { type: [String], default: [] },
    notes: String,
    contacts: { type: [contactSchema], default: [] },
    rounds: { type: [roundSchema], default: [] },
    links: {
      type: new Schema(
        { roadmapId: { type: Types.ObjectId, ref: 'Roadmap' } },
        { _id: false }
      ),
      default: () => ({}),
    },
    archived: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Main list query covers user + archived filter, sorted by updatedAt.
// CLAUDE.md rule: every compound index starts with userId.
jobApplicationSchema.index({ userId: 1, archived: 1, updatedAt: -1 });
// Sparse — supports a future "applications linked to roadmap X" view.
jobApplicationSchema.index(
  { userId: 1, 'links.roadmapId': 1 },
  { sparse: true }
);

// InferSchemaType doesn't surface timestamps even with `timestamps: true`,
// so declare them explicitly. `_id: string` matches the RoadmapDoc pattern;
// the serializer in Task 3 calls String(...) at every level to bridge the
// runtime ObjectId values.
export type JobApplicationDoc = InferSchemaType<typeof jobApplicationSchema> & {
  _id: string;
  createdAt: Date;
  updatedAt: Date;
};

export const JobApplicationModel = model('JobApplication', jobApplicationSchema);
