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
}
