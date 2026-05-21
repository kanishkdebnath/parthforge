import { Schema, model, type InferSchemaType, Types } from 'mongoose';

const eventSchema = new Schema(
  {
    text: { type: String, required: true },
    important: { type: Boolean, default: false },
    time: String,
  },
  { _id: true }
);

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
    tags: { type: [String], default: [] },
  },
  { _id: false }
);

const journalDaySchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: 'User', required: true },
    date: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
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

export type JournalDayDoc = InferSchemaType<typeof journalDaySchema> & {
  _id: string;
  createdAt: Date;
  updatedAt: Date;
};

export const JournalDayModel = model('JournalDay', journalDaySchema);
