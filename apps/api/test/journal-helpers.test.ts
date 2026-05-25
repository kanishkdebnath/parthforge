import { describe, it, expect } from 'vitest';
import { Types } from 'mongoose';
import { serializeJournalDay } from '../src/lib/journal-helpers.js';

const userId = new Types.ObjectId();

const doc = {
  _id: new Types.ObjectId(),
  userId,
  date: '2026-05-14',
  mood: { scale: 4, tags: ['focused'] },
  summary: 'Did things',
  events: [
    { _id: new Types.ObjectId(), text: 'first', important: true, time: '10am' },
    { _id: new Types.ObjectId(), text: 'second', important: false },
  ],
  links: [{ url: 'https://x.test', label: 'X' }],
  references: [
    { type: 'roadmap', roadmapId: new Types.ObjectId() },
    {
      type: 'milestone',
      roadmapId: new Types.ObjectId(),
      milestoneId: new Types.ObjectId(),
    },
    { type: 'job', jobId: new Types.ObjectId() },
  ],
  createdAt: new Date('2026-05-14T10:00:00Z'),
  updatedAt: new Date('2026-05-14T11:00:00Z'),
};

describe('serializeJournalDay', () => {
  it('stringifies all ObjectIds at every level', () => {
    const wire = serializeJournalDay(doc as never);
    expect(typeof wire._id).toBe('string');
    expect(typeof wire.userId).toBe('string');
    for (const e of wire.events) expect(typeof e._id).toBe('string');
    for (const ref of wire.references) {
      if (ref.type === 'roadmap') expect(typeof ref.roadmapId).toBe('string');
      if (ref.type === 'milestone') {
        expect(typeof ref.roadmapId).toBe('string');
        expect(typeof ref.milestoneId).toBe('string');
      }
      if (ref.type === 'job') expect(typeof ref.jobId).toBe('string');
    }
  });

  it('preserves Date instances on createdAt and updatedAt', () => {
    const wire = serializeJournalDay(doc as never);
    expect(wire.createdAt).toBeInstanceOf(Date);
    expect(wire.updatedAt).toBeInstanceOf(Date);
  });

  it('keeps the date string verbatim', () => {
    const wire = serializeJournalDay(doc as never);
    expect(wire.date).toBe('2026-05-14');
  });

  it('drops undefined optionals (summary, event.time)', () => {
    const minimal = { ...doc, summary: undefined, events: [] };
    const wire = serializeJournalDay(minimal as never);
    expect(wire.summary).toBeUndefined();
  });

  it('strips stray fields from reference variants', () => {
    const contaminated = {
      ...doc,
      references: [
        // roadmap variant with a stray milestoneId (could happen if a doc was
        // mutated without re-validating against the Zod schema).
        {
          type: 'roadmap',
          roadmapId: new Types.ObjectId(),
          milestoneId: new Types.ObjectId(),
        },
      ],
    };
    const wire = serializeJournalDay(contaminated as never);
    const ref = wire.references[0]!;
    expect(ref.type).toBe('roadmap');
    expect('milestoneId' in ref).toBe(false);
  });
});
