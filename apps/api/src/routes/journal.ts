import type { FastifyInstance, FastifyReply } from 'fastify';
import { Types } from 'mongoose';
import { z } from 'zod';
import {
  DateStringSchema,
  UpsertJournalDayRequestSchema,
} from '@pathforge/shared';
import { JournalDayModel } from '../models/JournalDay.js';
import {
  serializeJournalDay,
  validateReferenceOwnership,
} from '../lib/journal-helpers.js';

function daysBetween(fromIso: string, toIso: string): number {
  const from = Date.parse(`${fromIso}T00:00:00Z`);
  const to = Date.parse(`${toIso}T00:00:00Z`);
  return Math.round((to - from) / 86_400_000);
}

const RangeQuerySchema = z
  .object({
    from: DateStringSchema,
    to: DateStringSchema,
  })
  .refine((q) => q.from <= q.to, { message: 'from must be <= to', path: ['from'] })
  .refine((q) => daysBetween(q.from, q.to) <= 366, {
    message: 'range must be <= 366 days',
    path: ['to'],
  });

function sendValidationError(reply: FastifyReply, error: z.ZodError) {
  return reply.code(400).send({
    error: 'Invalid body',
    details: error.issues.map((i) => ({
      path: i.path.join('.'),
      message: i.message,
    })),
  });
}

export async function journalRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/journal/days?from=&to=
  app.get('/api/journal/days', { preHandler: [app.authenticate] }, async (request, reply) => {
    const parsed = RangeQuerySchema.safeParse(request.query);
    if (!parsed.success) return sendValidationError(reply, parsed.error);
    const userId = request.user!._id;
    const docs = await JournalDayModel.find({
      userId,
      date: { $gte: parsed.data.from, $lte: parsed.data.to },
    })
      .sort({ date: -1 })
      .lean();
    return docs.map((d) => serializeJournalDay(d as never));
  });

  // GET /api/journal/days/:date
  app.get('/api/journal/days/:date', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { date } = request.params as { date: string };
    if (!DateStringSchema.safeParse(date).success) {
      return reply.code(400).send({ error: 'Invalid date' });
    }
    const userId = request.user!._id;
    const doc = await JournalDayModel.findOne({ userId, date }).lean();
    if (!doc) return reply.code(404).send({ error: 'Not found' });
    return serializeJournalDay(doc as never);
  });

  // PUT /api/journal/days/:date — full-day upsert
  app.put('/api/journal/days/:date', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { date } = request.params as { date: string };
    if (!DateStringSchema.safeParse(date).success) {
      return reply.code(400).send({ error: 'Invalid date' });
    }
    const parsed = UpsertJournalDayRequestSchema.safeParse(request.body);
    if (!parsed.success) return sendValidationError(reply, parsed.error);

    const userId = request.user!._id;

    const badRef = await validateReferenceOwnership(userId, parsed.data.references);
    if (badRef) {
      return reply.code(400).send({ error: 'invalid-reference', ref: badRef });
    }

    const events = parsed.data.events.map((e) => ({
      _id: e._id ?? new Types.ObjectId().toString(),
      text: e.text,
      important: e.important,
      time: e.time,
    }));

    const doc = await JournalDayModel.findOneAndUpdate(
      { userId, date },
      {
        $set: {
          mood: parsed.data.mood,
          summary: parsed.data.summary,
          events,
          links: parsed.data.links,
          references: parsed.data.references,
        },
        $setOnInsert: { userId, date },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();

    if (!doc) return reply.code(409).send({ error: 'Conflict' });

    return serializeJournalDay(doc as never);
  });

  // DELETE /api/journal/days/:date
  app.delete('/api/journal/days/:date', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { date } = request.params as { date: string };
    if (!DateStringSchema.safeParse(date).success) {
      return reply.code(400).send({ error: 'Invalid date' });
    }
    const userId = request.user!._id;
    const result = await JournalDayModel.deleteOne({ userId, date });
    if (result.deletedCount === 0) {
      return reply.code(404).send({ error: 'Not found' });
    }
    return reply.code(204).send();
  });
}
