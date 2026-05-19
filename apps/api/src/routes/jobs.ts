import type { FastifyInstance } from 'fastify';
import { Types } from 'mongoose';
import {
  CreateJobApplicationRequestSchema,
  UpdateJobApplicationRequestSchema,
  CreateRoundRequestSchema,
  UpdateRoundRequestSchema,
  CreateContactRequestSchema,
  UpdateContactRequestSchema,
  ReorderRoundsRequestSchema,
} from '@pathforge/shared';
import { JobApplicationModel } from '../models/JobApplication.js';
import { serializeJobApplication } from '../lib/job-application-helpers.js';
import { validateReorderIds } from '../lib/reorder.js';

const OBJECT_ID = /^[a-f\d]{24}$/i;
function isValidId(s: string | undefined): s is string {
  return typeof s === 'string' && OBJECT_ID.test(s);
}

export async function jobsRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/jobs?archived=true|false
  app.get('/api/jobs', { preHandler: [app.authenticate] }, async (request) => {
    const userId = request.user!._id;
    const archived = (request.query as { archived?: string }).archived === 'true';
    const docs = await JobApplicationModel.find({ userId, archived })
      .sort({ updatedAt: -1 })
      .lean();
    return docs.map((d) => serializeJobApplication(d as never));
  });

  // POST /api/jobs
  app.post('/api/jobs', { preHandler: [app.authenticate] }, async (request, reply) => {
    const parsed = CreateJobApplicationRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid body' });
    }
    const userId = request.user!._id;
    const doc = await JobApplicationModel.create({
      userId,
      company: parsed.data.company,
      role: parsed.data.role,
      jobUrl: parsed.data.jobUrl,
      status: parsed.data.status ?? 'saved',
      appliedAt: parsed.data.appliedAt,
      resumeUrl: parsed.data.resumeUrl,
      location: parsed.data.location,
      workMode: parsed.data.workMode,
      salaryRange: parsed.data.salaryRange,
      offerAmount: parsed.data.offerAmount,
      tags: parsed.data.tags ?? [],
      notes: parsed.data.notes,
      contacts: [],
      rounds: [],
      links: parsed.data.links ?? {},
      archived: false,
    });
    return reply.code(201).send(serializeJobApplication(doc.toObject() as never));
  });

  // GET /api/jobs/:id
  app.get('/api/jobs/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!isValidId(id)) return reply.code(404).send({ error: 'Not found' });
    const userId = request.user!._id;
    const doc = await JobApplicationModel.findOne({ _id: id, userId }).lean();
    if (!doc) return reply.code(404).send({ error: 'Not found' });
    return serializeJobApplication(doc as never);
  });

  // PATCH /api/jobs/:id
  app.patch('/api/jobs/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!isValidId(id)) return reply.code(404).send({ error: 'Not found' });
    const parsed = UpdateJobApplicationRequestSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid body' });
    const userId = request.user!._id;
    const data = parsed.data;

    const set: Record<string, unknown> = {};
    const unset: Record<string, ''> = {};

    // Non-nullable scalars: only $set when provided.
    if (data.company !== undefined) set.company = data.company;
    if (data.role !== undefined) set.role = data.role;
    if (data.status !== undefined) set.status = data.status;
    if (data.tags !== undefined) set.tags = data.tags;
    if (data.archived !== undefined) set.archived = data.archived;

    // Nullable scalars: null → $unset, value → $set, undefined → skip.
    // Narrow union keeps the loop honest — adding a non-nullable key here
    // becomes a compile error, not a silent $unset.
    type NullableScalarKey =
      | 'jobUrl'
      | 'appliedAt'
      | 'resumeUrl'
      | 'location'
      | 'workMode'
      | 'salaryRange'
      | 'offerAmount'
      | 'notes';
    const nullable: NullableScalarKey[] = [
      'jobUrl',
      'appliedAt',
      'resumeUrl',
      'location',
      'workMode',
      'salaryRange',
      'offerAmount',
      'notes',
    ];
    for (const key of nullable) {
      const v = data[key];
      if (v === undefined) continue;
      if (v === null) unset[key] = '';
      else set[key] = v;
    }

    // links is its own small object — patch by replacement (it has only one
    // field today). `links.roadmapId: null` clears it.
    if (data.links !== undefined) {
      if (data.links.roadmapId === null) unset['links.roadmapId'] = '';
      else if (data.links.roadmapId !== undefined)
        set['links.roadmapId'] = data.links.roadmapId;
    }

    const update: Record<string, unknown> = {};
    if (Object.keys(set).length > 0) update.$set = set;
    if (Object.keys(unset).length > 0) update.$unset = unset;
    if (Object.keys(update).length === 0) {
      // No-op patch — return the doc to keep the contract.
      const doc = await JobApplicationModel.findOne({ _id: id, userId }).lean();
      if (!doc) return reply.code(404).send({ error: 'Not found' });
      return serializeJobApplication(doc as never);
    }

    const doc = await JobApplicationModel.findOneAndUpdate(
      { _id: id, userId },
      update,
      { new: true }
    ).lean();
    if (!doc) return reply.code(404).send({ error: 'Not found' });
    return serializeJobApplication(doc as never);
  });

  // DELETE /api/jobs/:id
  app.delete('/api/jobs/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!isValidId(id)) return reply.code(404).send({ error: 'Not found' });
    const userId = request.user!._id;
    const result = await JobApplicationModel.deleteOne({ _id: id, userId });
    if (result.deletedCount === 0) return reply.code(404).send({ error: 'Not found' });
    return { ok: true };
  });
}
