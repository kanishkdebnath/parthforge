import type { FastifyInstance } from 'fastify';
import {
  CreateRoadmapRequestSchema,
  UpdateRoadmapRequestSchema,
} from '@pathforge/shared';
import { RoadmapModel } from '../models/Roadmap.js';
import { serializeRoadmap } from '../lib/roadmap-helpers.js';

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
}
