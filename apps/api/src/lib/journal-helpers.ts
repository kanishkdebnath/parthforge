import type { JournalDay, JournalReference } from '@pathforge/shared';
import type { JournalDayDoc } from '../models/JournalDay.js';
import { RoadmapModel } from '../models/Roadmap.js';
import { JobApplicationModel } from '../models/JobApplication.js';

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

/**
 * Checks that every reference points to a doc owned by `userId`. Returns
 * the first invalid reference (so the caller can echo it in the 400 body),
 * or null if all references are valid.
 *
 * Performs one query per reference (sequential) — references are capped at
 * 10 per day by the Zod schema, so the absolute cost is bounded.
 */
export async function validateReferenceOwnership(
  userId: string,
  refs: JournalReference[]
): Promise<JournalReference | null> {
  for (const ref of refs) {
    if (ref.type === 'roadmap') {
      const exists = await RoadmapModel.exists({ _id: ref.roadmapId, userId });
      if (!exists) return ref;
    } else if (ref.type === 'milestone') {
      const exists = await RoadmapModel.exists({
        _id: ref.roadmapId,
        userId,
        'milestones._id': ref.milestoneId,
      });
      if (!exists) return ref;
    } else if (ref.type === 'job') {
      const exists = await JobApplicationModel.exists({ _id: ref.jobId, userId });
      if (!exists) return ref;
    }
  }
  return null;
}
