import type { JobApplication } from '@pathforge/shared';
import type { JobApplicationDoc } from '../models/JobApplication.js';

/**
 * Converts a Mongoose lean job-application doc into the wire `JobApplication`
 * shape: stringifies all ObjectIds at every level, preserves Date instances
 * as Dates, and leaves undefined optionals undefined (so the JSON serializer
 * drops them). Mirrors serializeRoadmap.
 */
export function serializeJobApplication(doc: JobApplicationDoc): JobApplication {
  return {
    _id: String(doc._id),
    userId: String(doc.userId),
    company: doc.company,
    role: doc.role,
    jobUrl: doc.jobUrl ?? undefined,
    status: doc.status,
    appliedAt: doc.appliedAt ?? undefined,
    resumeUrl: doc.resumeUrl ?? undefined,
    location: doc.location ?? undefined,
    workMode: doc.workMode ?? undefined,
    salaryRange: doc.salaryRange ?? undefined,
    offerAmount: doc.offerAmount ?? undefined,
    tags: doc.tags ?? [],
    notes: doc.notes ?? undefined,
    contacts: (doc.contacts ?? []).map((c) => ({
      _id: String(c._id),
      name: c.name,
      role: c.role ?? undefined,
      email: c.email ?? undefined,
    })),
    rounds: (doc.rounds ?? []).map((r) => ({
      _id: String(r._id),
      name: r.name,
      scheduledAt: r.scheduledAt ?? undefined,
      durationMinutes: r.durationMinutes ?? undefined,
      interviewer: r.interviewer ?? undefined,
      outcome: r.outcome,
      prepNotes: r.prepNotes ?? undefined,
      questions: r.questions ?? [],
      experience: r.experience ?? undefined,
    })),
    links: {
      roadmapId:
        doc.links && doc.links.roadmapId
          ? String(doc.links.roadmapId)
          : undefined,
    },
    archived: doc.archived,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}
