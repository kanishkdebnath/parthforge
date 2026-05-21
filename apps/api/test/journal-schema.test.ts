import { describe, it, expect } from 'vitest';
import {
  JournalDaySchema,
  UpsertJournalDayRequestSchema,
  ReferenceSchema,
  MoodSchema,
  MOOD_TAGS,
} from '@pathforge/shared';

const oid = () => '507f1f77bcf86cd799439011';

const validDay = {
  _id: oid(),
  userId: oid(),
  date: '2026-05-14',
  mood: { scale: 4, tags: ['focused', 'grateful'] },
  summary: 'Pushed the tour fix',
  events: [
    { _id: oid(), text: 'Shipped the cascade fix', important: true, time: '10am' },
  ],
  links: [{ url: 'https://example.com', label: 'PR' }],
  references: [{ type: 'roadmap', roadmapId: oid() }],
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('JournalDaySchema', () => {
  it('parses a canonical day', () => {
    expect(JournalDaySchema.safeParse(validDay).success).toBe(true);
  });

  it('rejects a bad date format', () => {
    expect(JournalDaySchema.safeParse({ ...validDay, date: '2026/05/14' }).success).toBe(false);
    expect(JournalDaySchema.safeParse({ ...validDay, date: '14-05-2026' }).success).toBe(false);
  });

  it('rejects calendar-invalid dates', () => {
    expect(JournalDaySchema.safeParse({ ...validDay, date: '2026-00-14' }).success).toBe(false);
    expect(JournalDaySchema.safeParse({ ...validDay, date: '2026-13-14' }).success).toBe(false);
    expect(JournalDaySchema.safeParse({ ...validDay, date: '2026-05-00' }).success).toBe(false);
    expect(JournalDaySchema.safeParse({ ...validDay, date: '2026-05-32' }).success).toBe(false);
  });

  it('rejects mood scale outside 1..5', () => {
    expect(JournalDaySchema.safeParse({ ...validDay, mood: { scale: 0, tags: [] } }).success).toBe(false);
    expect(JournalDaySchema.safeParse({ ...validDay, mood: { scale: 6, tags: [] } }).success).toBe(false);
  });

  it('rejects tags not in MOOD_TAGS', () => {
    expect(MoodSchema.safeParse({ scale: 3, tags: ['nonsense'] }).success).toBe(false);
  });

  it('caps tags at 3', () => {
    expect(MoodSchema.safeParse({ scale: 3, tags: MOOD_TAGS.slice(0, 4) }).success).toBe(false);
  });

  it('caps events at 20', () => {
    const events = Array.from({ length: 21 }, (_, i) => ({
      _id: oid(),
      text: `e${i}`,
      important: false,
    }));
    expect(JournalDaySchema.safeParse({ ...validDay, events }).success).toBe(false);
  });

  it('caps links at 10', () => {
    const links = Array.from({ length: 11 }, () => ({ url: 'https://example.com' }));
    expect(JournalDaySchema.safeParse({ ...validDay, links }).success).toBe(false);
  });

  it('caps references at 10', () => {
    const references = Array.from({ length: 11 }, () => ({ type: 'job', jobId: oid() }));
    expect(JournalDaySchema.safeParse({ ...validDay, references }).success).toBe(false);
  });
});

describe('ReferenceSchema', () => {
  it('parses a roadmap reference', () => {
    expect(ReferenceSchema.safeParse({ type: 'roadmap', roadmapId: oid() }).success).toBe(true);
  });

  it('parses a milestone reference with both ids', () => {
    expect(
      ReferenceSchema.safeParse({ type: 'milestone', roadmapId: oid(), milestoneId: oid() }).success
    ).toBe(true);
  });

  it('rejects a milestone reference missing milestoneId', () => {
    expect(ReferenceSchema.safeParse({ type: 'milestone', roadmapId: oid() }).success).toBe(false);
  });

  it('parses a job reference', () => {
    expect(ReferenceSchema.safeParse({ type: 'job', jobId: oid() }).success).toBe(true);
  });

  it('rejects unknown type', () => {
    expect(ReferenceSchema.safeParse({ type: 'note', noteId: oid() }).success).toBe(false);
  });
});

describe('UpsertJournalDayRequestSchema', () => {
  it('accepts events without _id (new events)', () => {
    const body = {
      mood: { scale: 3, tags: [] },
      events: [{ text: 'fresh event', important: false }],
      links: [],
      references: [],
    };
    expect(UpsertJournalDayRequestSchema.safeParse(body).success).toBe(true);
  });

  it('accepts events with _id (preserved events)', () => {
    const body = {
      mood: { scale: 3, tags: [] },
      events: [{ _id: oid(), text: 'preserved', important: true }],
      links: [],
      references: [],
    };
    expect(UpsertJournalDayRequestSchema.safeParse(body).success).toBe(true);
  });

  it('defaults arrays when omitted', () => {
    const parsed = UpsertJournalDayRequestSchema.safeParse({ mood: { scale: 3, tags: [] } });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.events).toEqual([]);
      expect(parsed.data.links).toEqual([]);
      expect(parsed.data.references).toEqual([]);
    }
  });
});
