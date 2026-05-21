import type { JournalDay, JournalReference } from '@pathforge/shared';
import type { JournalDayDoc } from '../models/JournalDay.js';

/**
 * Converts a lean Mongo doc into the wire shape: stringifies every ObjectId
 * (top-level, event _ids, and ref ids), keeps Dates as Dates, drops absent
 * optionals as undefined. Mirrors serializeJobApplication.
 */
export function serializeJournalDay(doc: JournalDayDoc): JournalDay {
  return {
    _id: String(doc._id),
    userId: String(doc.userId),
    date: doc.date,
    mood: {
      scale: doc.mood.scale,
      tags: (doc.mood.tags ?? []) as JournalDay['mood']['tags'],
    },
    summary: doc.summary ?? undefined,
    events: (doc.events ?? []).map((e) => ({
      _id: String(e._id),
      text: e.text,
      important: e.important ?? false,
      time: e.time ?? undefined,
    })),
    links: (doc.links ?? []).map((l) => ({
      url: l.url,
      label: l.label ?? undefined,
    })),
    references: (doc.references ?? []).map((r): JournalReference => {
      if (r.type === 'roadmap') {
        return { type: 'roadmap', roadmapId: String(r.roadmapId) };
      }
      if (r.type === 'milestone') {
        return {
          type: 'milestone',
          roadmapId: String(r.roadmapId),
          milestoneId: String(r.milestoneId),
        };
      }
      return { type: 'job', jobId: String(r.jobId) };
    }),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}
