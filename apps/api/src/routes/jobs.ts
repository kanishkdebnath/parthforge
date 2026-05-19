import type { FastifyInstance, FastifyReply } from 'fastify';
import { Types } from 'mongoose';
import { z } from 'zod';
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

// Returns a 400 with field-level Zod issue detail so clients can surface
// actionable error messages (e.g. "jobUrl: URL must use http or https")
// instead of the bare "Invalid body".
function sendValidationError(reply: FastifyReply, error: z.ZodError) {
  return reply.code(400).send({
    error: 'Invalid body',
    details: error.issues.map((i) => ({
      path: i.path.join('.'),
      message: i.message,
    })),
  });
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
      return sendValidationError(reply, parsed.error);
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
    if (!parsed.success) return sendValidationError(reply, parsed.error);
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

  // POST /api/jobs/:id/rounds
  app.post(
    '/api/jobs/:id/rounds',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      if (!isValidId(id)) return reply.code(404).send({ error: 'Not found' });
      const parsed = CreateRoundRequestSchema.safeParse(request.body);
      if (!parsed.success) return sendValidationError(reply, parsed.error);
      const userId = request.user!._id;
      const round = {
        _id: new Types.ObjectId(),
        name: parsed.data.name,
        scheduledAt: parsed.data.scheduledAt,
        durationMinutes: parsed.data.durationMinutes,
        interviewer: parsed.data.interviewer,
        outcome: parsed.data.outcome ?? 'pending',
        prepNotes: parsed.data.prepNotes,
        questions: parsed.data.questions ?? [],
        experience: parsed.data.experience,
      };
      const doc = await JobApplicationModel.findOneAndUpdate(
        { _id: id, userId },
        { $push: { rounds: round } },
        { new: true }
      ).lean();
      if (!doc) return reply.code(404).send({ error: 'Not found' });
      return reply.code(201).send(serializeJobApplication(doc as never));
    }
  );

  // PATCH /api/jobs/:id/rounds/:roundId
  app.patch(
    '/api/jobs/:id/rounds/:roundId',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id, roundId } = request.params as { id: string; roundId: string };
      if (!isValidId(id) || !isValidId(roundId))
        return reply.code(404).send({ error: 'Not found' });
      const parsed = UpdateRoundRequestSchema.safeParse(request.body);
      if (!parsed.success) return sendValidationError(reply, parsed.error);
      const userId = request.user!._id;
      const data = parsed.data;

      const set: Record<string, unknown> = {};
      const unset: Record<string, ''> = {};

      if (data.name !== undefined) set['rounds.$[r].name'] = data.name;
      if (data.outcome !== undefined) set['rounds.$[r].outcome'] = data.outcome;
      if (data.questions !== undefined) set['rounds.$[r].questions'] = data.questions;

      // Narrow union keeps the loop honest — adding a non-nullable key here
      // becomes a compile error, not a silent $unset.
      type NullableRoundKey =
        | 'scheduledAt'
        | 'durationMinutes'
        | 'interviewer'
        | 'prepNotes'
        | 'experience';
      const nullable: NullableRoundKey[] = [
        'scheduledAt',
        'durationMinutes',
        'interviewer',
        'prepNotes',
        'experience',
      ];
      for (const key of nullable) {
        const v = data[key];
        if (v === undefined) continue;
        if (v === null) unset[`rounds.$[r].${key}`] = '';
        else set[`rounds.$[r].${key}`] = v;
      }

      const update: Record<string, unknown> = {};
      if (Object.keys(set).length > 0) update.$set = set;
      if (Object.keys(unset).length > 0) update.$unset = unset;
      if (Object.keys(update).length === 0) {
        // No-op patch — still validate ownership + round existence.
        const doc = await JobApplicationModel.findOne({
          _id: id,
          userId,
          'rounds._id': new Types.ObjectId(roundId),
        }).lean();
        if (!doc) return reply.code(404).send({ error: 'Not found' });
        return serializeJobApplication(doc as never);
      }

      const doc = await JobApplicationModel.findOneAndUpdate(
        { _id: id, userId, 'rounds._id': new Types.ObjectId(roundId) },
        update,
        { new: true, arrayFilters: [{ 'r._id': new Types.ObjectId(roundId) }] }
      ).lean();
      if (!doc) return reply.code(404).send({ error: 'Not found' });
      return serializeJobApplication(doc as never);
    }
  );

  // DELETE /api/jobs/:id/rounds/:roundId
  app.delete(
    '/api/jobs/:id/rounds/:roundId',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id, roundId } = request.params as { id: string; roundId: string };
      if (!isValidId(id) || !isValidId(roundId))
        return reply.code(404).send({ error: 'Not found' });
      const userId = request.user!._id;
      const doc = await JobApplicationModel.findOneAndUpdate(
        { _id: id, userId, 'rounds._id': new Types.ObjectId(roundId) },
        { $pull: { rounds: { _id: new Types.ObjectId(roundId) } } },
        { new: true }
      ).lean();
      if (!doc) return reply.code(404).send({ error: 'Not found' });
      return serializeJobApplication(doc as never);
    }
  );

  // PUT /api/jobs/:id/rounds/order
  app.put(
    '/api/jobs/:id/rounds/order',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      if (!isValidId(id)) return reply.code(404).send({ error: 'Not found' });
      const parsed = ReorderRoundsRequestSchema.safeParse(request.body);
      if (!parsed.success) return sendValidationError(reply, parsed.error);
      const userId = request.user!._id;

      const doc = await JobApplicationModel.findOne({ _id: id, userId });
      if (!doc) return reply.code(404).send({ error: 'Not found' });

      const existing = doc.rounds.map((r) => String(r._id));
      const err = validateReorderIds(existing, parsed.data.ids);
      if (err) return reply.code(400).send({ error: err });

      const byId = new Map(doc.rounds.map((r) => [String(r._id), r]));
      const reordered = parsed.data.ids.map((rid) => byId.get(rid)!);
      doc.rounds.splice(0, doc.rounds.length, ...reordered);
      await doc.save();
      const fresh = await JobApplicationModel.findOne({ _id: id, userId }).lean();
      return serializeJobApplication(fresh as never);
    }
  );

  // POST /api/jobs/:id/contacts
  app.post(
    '/api/jobs/:id/contacts',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      if (!isValidId(id)) return reply.code(404).send({ error: 'Not found' });
      const parsed = CreateContactRequestSchema.safeParse(request.body);
      if (!parsed.success) return sendValidationError(reply, parsed.error);
      const userId = request.user!._id;
      const contact = {
        _id: new Types.ObjectId(),
        name: parsed.data.name,
        role: parsed.data.role,
        email: parsed.data.email,
      };
      const doc = await JobApplicationModel.findOneAndUpdate(
        { _id: id, userId },
        { $push: { contacts: contact } },
        { new: true }
      ).lean();
      if (!doc) return reply.code(404).send({ error: 'Not found' });
      return reply.code(201).send(serializeJobApplication(doc as never));
    }
  );

  // PATCH /api/jobs/:id/contacts/:contactId
  app.patch(
    '/api/jobs/:id/contacts/:contactId',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id, contactId } = request.params as {
        id: string;
        contactId: string;
      };
      if (!isValidId(id) || !isValidId(contactId))
        return reply.code(404).send({ error: 'Not found' });
      const parsed = UpdateContactRequestSchema.safeParse(request.body);
      if (!parsed.success) return sendValidationError(reply, parsed.error);
      const userId = request.user!._id;
      const data = parsed.data;

      const set: Record<string, unknown> = {};
      const unset: Record<string, ''> = {};
      if (data.name !== undefined) set['contacts.$[c].name'] = data.name;

      // Narrow union keeps the loop honest — adding a non-nullable key here
      // becomes a compile error, not a silent $unset.
      type NullableContactKey = 'role' | 'email';
      const nullable: NullableContactKey[] = ['role', 'email'];
      for (const key of nullable) {
        const v = data[key];
        if (v === undefined) continue;
        if (v === null) unset[`contacts.$[c].${key}`] = '';
        else set[`contacts.$[c].${key}`] = v;
      }

      const update: Record<string, unknown> = {};
      if (Object.keys(set).length > 0) update.$set = set;
      if (Object.keys(unset).length > 0) update.$unset = unset;
      if (Object.keys(update).length === 0) {
        // No-op patch — still validate ownership + contact existence.
        const doc = await JobApplicationModel.findOne({
          _id: id,
          userId,
          'contacts._id': new Types.ObjectId(contactId),
        }).lean();
        if (!doc) return reply.code(404).send({ error: 'Not found' });
        return serializeJobApplication(doc as never);
      }

      const doc = await JobApplicationModel.findOneAndUpdate(
        { _id: id, userId, 'contacts._id': new Types.ObjectId(contactId) },
        update,
        { new: true, arrayFilters: [{ 'c._id': new Types.ObjectId(contactId) }] }
      ).lean();
      if (!doc) return reply.code(404).send({ error: 'Not found' });
      return serializeJobApplication(doc as never);
    }
  );

  // DELETE /api/jobs/:id/contacts/:contactId
  app.delete(
    '/api/jobs/:id/contacts/:contactId',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id, contactId } = request.params as {
        id: string;
        contactId: string;
      };
      if (!isValidId(id) || !isValidId(contactId))
        return reply.code(404).send({ error: 'Not found' });
      const userId = request.user!._id;
      const doc = await JobApplicationModel.findOneAndUpdate(
        { _id: id, userId, 'contacts._id': new Types.ObjectId(contactId) },
        { $pull: { contacts: { _id: new Types.ObjectId(contactId) } } },
        { new: true }
      ).lean();
      if (!doc) return reply.code(404).send({ error: 'Not found' });
      return serializeJobApplication(doc as never);
    }
  );
}
