import { Schema, model, type InferSchemaType, Types } from 'mongoose';
import { MOOD_TAGS } from '@pathforge/shared';

const eventSchema = new Schema(
  {
    text: { type: String, required: true },
    important: { type: Boolean, default: false },
    time: String,
  },
  { _id: true }
);

// Reference variants are validated by Zod (`ReferenceSchema` discriminated
// union) at the route boundary. Mongoose stores the flat shape and does not
// enforce that `type=roadmap` excludes `milestoneId`/`jobId`. Any direct
// model writes (seeds, scripts) must pre-validate against the Zod schema.
const referenceSchema = new Schema(
  {
    type: {
      type: String,
      enum: ['roadmap', 'milestone', 'job'],
      required: true,
    },
    roadmapId: { type: Types.ObjectId, ref: 'Roadmap' },
    milestoneId: { type: Types.ObjectId },
    jobId: { type: Types.ObjectId, ref: 'JobApplication' },
  },
  { _id: false }
);

const linkSchema = new Schema(
  { url: { type: String, required: true }, label: String },
  { _id: false }
);

const moodSchema = new Schema(
  {
    scale: { type: Number, required: true, min: 1, max: 5 },
    tags: { type: [String], enum: [...MOOD_TAGS], default: [] },
  },
  { _id: false }
);

const journalDaySchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: 'User', required: true },
    date: {
      type: String,
      required: true,
      match: /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/,
    },
    mood: { type: moodSchema, required: true },
    summary: String,
    events: { type: [eventSchema], default: [] },
    links: { type: [linkSchema], default: [] },
    references: { type: [referenceSchema], default: [] },
  },
  { timestamps: true }
);

// One day per user per date.
journalDaySchema.index({ userId: 1, date: -1 }, { unique: true });

// InferSchemaType doesn't surface timestamps even with `timestamps: true`,
// so declare them explicitly. `_id: string` matches the JobApplicationDoc
// precedent; the serializer calls String(...) at every ObjectId site to
// bridge the runtime ObjectId values.
export type JournalDayDoc = InferSchemaType<typeof journalDaySchema> & {
  _id: string;
  createdAt: Date;
  updatedAt: Date;
};

export const JournalDayModel = model('JournalDay', journalDaySchema);
