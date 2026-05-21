import { z } from 'zod';
import { LinkSchema } from './link.js';
import { ObjectIdString } from './objectId.js';

export const MOOD_TAGS = [
  'focused', 'tired', 'anxious', 'grateful',
  'restless', 'excited', 'low', 'calm',
] as const;
export const MoodTagSchema = z.enum(MOOD_TAGS);
export type MoodTag = z.infer<typeof MoodTagSchema>;

export const MoodSchema = z.object({
  scale: z.number().int().min(1).max(5),
  tags: z.array(MoodTagSchema).max(3).default([]),
});
export type Mood = z.infer<typeof MoodSchema>;

export const EventSchema = z.object({
  _id: ObjectIdString,
  text: z.string().min(1).max(500),
  important: z.boolean().default(false),
  time: z.string().max(20).optional(),
});
export type JournalEvent = z.infer<typeof EventSchema>;

export const ReferenceSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('roadmap'), roadmapId: ObjectIdString }),
  z.object({
    type: z.literal('milestone'),
    roadmapId: ObjectIdString,
    milestoneId: ObjectIdString,
  }),
  z.object({ type: z.literal('job'), jobId: ObjectIdString }),
]);
export type JournalReference = z.infer<typeof ReferenceSchema>;

export const DateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD');

export const JournalDaySchema = z.object({
  _id: ObjectIdString,
  userId: ObjectIdString,
  date: DateStringSchema,
  mood: MoodSchema,
  summary: z.string().max(500).optional(),
  events: z.array(EventSchema).max(20).default([]),
  links: z.array(LinkSchema).max(10).default([]),
  references: z.array(ReferenceSchema).max(10).default([]),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type JournalDay = z.infer<typeof JournalDaySchema>;

const EventInputSchema = EventSchema.extend({
  _id: ObjectIdString.optional(),
});

export const UpsertJournalDayRequestSchema = z.object({
  mood: MoodSchema,
  summary: z.string().max(500).optional(),
  events: z.array(EventInputSchema).max(20).default([]),
  links: z.array(LinkSchema).max(10).default([]),
  references: z.array(ReferenceSchema).max(10).default([]),
});
export type UpsertJournalDayRequest = z.infer<typeof UpsertJournalDayRequestSchema>;
