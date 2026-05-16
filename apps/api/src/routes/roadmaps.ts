import type { FastifyInstance } from 'fastify';
import { Types } from 'mongoose';
import {
  CreateRoadmapRequestSchema,
  UpdateRoadmapRequestSchema,
  CreateMilestoneRequestSchema,
  UpdateMilestoneRequestSchema,
  ReorderRequestSchema,
} from '@pathforge/shared';
import { RoadmapModel } from '../models/Roadmap.js';
import { serializeRoadmap, validateReorderIds } from '../lib/roadmap-helpers.js';

const OBJECT_ID = /^[a-f\d]{24}$/i;

function isValidId(s: string | undefined): s is string {
  return typeof s === 'string' && OBJECT_ID.test(s);
}

export async function roadmapsRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/roadmaps?archived=true|false
  app.get('/api/roadmaps', { preHandler: [app.authenticate] }, async (request) => {
    const userId = request.user!._id;
    const archived = (request.query as { archived?: string }).archived === 'true';
    const docs = await RoadmapModel.find({ userId, archived }).sort({ updatedAt: -1 }).lean();
    return docs.map((d) => serializeRoadmap(d as never));
  });

  // POST /api/roadmaps
  app.post('/api/roadmaps', { preHandler: [app.authenticate] }, async (request, reply) => {
    const parsed = CreateRoadmapRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid body' });
    }
    const userId = request.user!._id;
    const doc = await RoadmapModel.create({
      userId,
      title: parsed.data.title,
      description: parsed.data.description,
      deadline: parsed.data.deadline,
      archived: false,
      milestones: [],
    });
    return reply.code(201).send(serializeRoadmap(doc.toObject() as never));
  });

  // GET /api/roadmaps/:id
  app.get('/api/roadmaps/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!isValidId(id)) return reply.code(404).send({ error: 'Not found' });
    const userId = request.user!._id;
    const doc = await RoadmapModel.findOne({ _id: id, userId }).lean();
    if (!doc) return reply.code(404).send({ error: 'Not found' });
    return serializeRoadmap(doc as never);
  });

  // PATCH /api/roadmaps/:id
  app.patch('/api/roadmaps/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!isValidId(id)) return reply.code(404).send({ error: 'Not found' });
    const parsed = UpdateRoadmapRequestSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid body' });
    const userId = request.user!._id;

    const set: Record<string, unknown> = {};
    const unset: Record<string, ''> = {};
    if (parsed.data.title !== undefined) set.title = parsed.data.title;
    if (parsed.data.description !== undefined) set.description = parsed.data.description;
    if (parsed.data.archived !== undefined) set.archived = parsed.data.archived;
    if (parsed.data.deadline === null) unset.deadline = '';
    else if (parsed.data.deadline !== undefined) set.deadline = parsed.data.deadline;

    const update: Record<string, unknown> = {};
    if (Object.keys(set).length > 0) update.$set = set;
    if (Object.keys(unset).length > 0) update.$unset = unset;

    const doc = await RoadmapModel.findOneAndUpdate(
      { _id: id, userId },
      update,
      { new: true }
    ).lean();
    if (!doc) return reply.code(404).send({ error: 'Not found' });
    return serializeRoadmap(doc as never);
  });

  // DELETE /api/roadmaps/:id
  app.delete('/api/roadmaps/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!isValidId(id)) return reply.code(404).send({ error: 'Not found' });
    const userId = request.user!._id;
    const result = await RoadmapModel.deleteOne({ _id: id, userId });
    if (result.deletedCount === 0) return reply.code(404).send({ error: 'Not found' });
    return { ok: true };
  });

  // POST /api/roadmaps/:id/milestones
  app.post(
    '/api/roadmaps/:id/milestones',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      if (!isValidId(id)) return reply.code(404).send({ error: 'Not found' });
      const parsed = CreateMilestoneRequestSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: 'Invalid body' });
      const userId = request.user!._id;
      const milestone = {
        _id: new Types.ObjectId(),
        title: parsed.data.title,
        description: parsed.data.description,
        deadline: parsed.data.deadline,
        steps: [],
      };
      const doc = await RoadmapModel.findOneAndUpdate(
        { _id: id, userId },
        { $push: { milestones: milestone } },
        { new: true }
      ).lean();
      if (!doc) return reply.code(404).send({ error: 'Not found' });
      return reply.code(201).send(serializeRoadmap(doc as never));
    }
  );

  // PATCH /api/roadmaps/:id/milestones/:mid
  app.patch(
    '/api/roadmaps/:id/milestones/:mid',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id, mid } = request.params as { id: string; mid: string };
      if (!isValidId(id) || !isValidId(mid)) return reply.code(404).send({ error: 'Not found' });
      const parsed = UpdateMilestoneRequestSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: 'Invalid body' });
      const userId = request.user!._id;

      const set: Record<string, unknown> = {};
      const unset: Record<string, ''> = {};
      if (parsed.data.title !== undefined) set['milestones.$[m].title'] = parsed.data.title;
      if (parsed.data.description !== undefined)
        set['milestones.$[m].description'] = parsed.data.description;
      if (parsed.data.deadline === null) unset['milestones.$[m].deadline'] = '';
      else if (parsed.data.deadline !== undefined)
        set['milestones.$[m].deadline'] = parsed.data.deadline;

      const update: Record<string, unknown> = {};
      if (Object.keys(set).length > 0) update.$set = set;
      if (Object.keys(unset).length > 0) update.$unset = unset;
      if (Object.keys(update).length === 0) {
        // No-op patch — still return the doc to keep the contract.
        // Use the same milestone-id filter as the mutating branch so 404
        // logic stays unified across both paths.
        const doc = await RoadmapModel.findOne({
          _id: id,
          userId,
          'milestones._id': new Types.ObjectId(mid),
        }).lean();
        if (!doc) return reply.code(404).send({ error: 'Not found' });
        return serializeRoadmap(doc as never);
      }

      const doc = await RoadmapModel.findOneAndUpdate(
        { _id: id, userId, 'milestones._id': new Types.ObjectId(mid) },
        update,
        { new: true, arrayFilters: [{ 'm._id': new Types.ObjectId(mid) }] }
      ).lean();
      if (!doc) return reply.code(404).send({ error: 'Not found' });
      return serializeRoadmap(doc as never);
    }
  );

  // DELETE /api/roadmaps/:id/milestones/:mid
  app.delete(
    '/api/roadmaps/:id/milestones/:mid',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id, mid } = request.params as { id: string; mid: string };
      if (!isValidId(id) || !isValidId(mid)) return reply.code(404).send({ error: 'Not found' });
      const userId = request.user!._id;
      const doc = await RoadmapModel.findOneAndUpdate(
        { _id: id, userId, 'milestones._id': new Types.ObjectId(mid) },
        { $pull: { milestones: { _id: new Types.ObjectId(mid) } } },
        { new: true }
      ).lean();
      if (!doc) return reply.code(404).send({ error: 'Not found' });
      return serializeRoadmap(doc as never);
    }
  );

  // PUT /api/roadmaps/:id/milestones/reorder
  app.put(
    '/api/roadmaps/:id/milestones/reorder',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      if (!isValidId(id)) return reply.code(404).send({ error: 'Not found' });
      const parsed = ReorderRequestSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: 'Invalid body' });
      const userId = request.user!._id;

      const doc = await RoadmapModel.findOne({ _id: id, userId });
      if (!doc) return reply.code(404).send({ error: 'Not found' });

      const existing = doc.milestones.map((m) => String(m._id));
      const err = validateReorderIds(existing, parsed.data.ids);
      if (err) return reply.code(400).send({ error: err });

      const byId = new Map(doc.milestones.map((m) => [String(m._id), m]));
      // Splice in the new order in-place so Mongoose tracks the dirty state.
      const reordered = parsed.data.ids.map((mid) => byId.get(mid)!);
      doc.milestones.splice(0, doc.milestones.length, ...reordered);
      await doc.save();
      const fresh = await RoadmapModel.findOne({ _id: id, userId }).lean();
      return serializeRoadmap(fresh as never);
    }
  );
}
