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
}
