import type { FastifyInstance, FastifyReply } from 'fastify';
import { Types } from 'mongoose';
import { z } from 'zod';
import {
  CreateBudgetGroupRequestSchema,
  UpdateBudgetGroupRequestSchema,
  BudgetReorderRequestSchema,
} from '@pathforge/shared';
import { BudgetCategoryGroupModel } from '../models/BudgetCategoryGroup.js';
import { BudgetCategoryModel } from '../models/BudgetCategory.js';
import {
  defaultGroupsSeed,
  defaultCategoriesSeed,
  serializeBudgetGroup,
} from '../lib/budget-helpers.js';
import { validateReorderIds } from '../lib/reorder.js';

function sendValidationError(reply: FastifyReply, error: z.ZodError) {
  return reply.code(400).send({
    error: 'Invalid body',
    details: error.issues.map((i) => ({
      path: i.path.join('.'),
      message: i.message,
    })),
  });
}

/**
 * Seeds default groups + categories for a user that has none. Idempotent:
 * if any group already exists, this is a no-op. If the category insert
 * fails after groups have been written, the just-inserted groups are
 * rolled back so a retry seeds cleanly — otherwise the user would be
 * permanently stuck with groups-but-no-categories.
 *
 * Not wrapped in a session/transaction — Mongo single-node dev mode doesn't
 * support multi-document transactions, hence the manual rollback above.
 */
async function seedDefaultsIfEmpty(userId: string): Promise<void> {
  const existing = await BudgetCategoryGroupModel.exists({ userId });
  if (existing) return;

  const groupSeeds = defaultGroupsSeed();
  const insertedGroups = await BudgetCategoryGroupModel.insertMany(
    groupSeeds.map((g) => ({
      userId: new Types.ObjectId(userId),
      name: g.name,
      color: g.color,
      order: g.order,
    }))
  );

  const groupIdByName = new Map(
    insertedGroups.map((g) => [g.name, g._id as Types.ObjectId])
  );

  try {
    const categorySeeds = defaultCategoriesSeed();
    await BudgetCategoryModel.insertMany(
      categorySeeds.map((c) => ({
        userId: new Types.ObjectId(userId),
        groupId: groupIdByName.get(c.groupName)!,
        name: c.name,
        kind: c.kind,
        order: c.order,
      }))
    );
  } catch (err) {
    // Rollback: delete the just-inserted groups so a retry seeds cleanly.
    // Without this, the next GET sees groups-exist and skips seeding,
    // leaving the user permanently with groups-but-no-categories.
    await BudgetCategoryGroupModel.deleteMany({
      _id: { $in: insertedGroups.map((g) => g._id) },
    });
    throw err;
  }
}

export async function budgetRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/budget/groups — seed-on-first-read
  app.get(
    '/api/budget/groups',
    { preHandler: [app.authenticate] },
    async (request) => {
      const userId = request.user!._id;
      await seedDefaultsIfEmpty(userId);
      const docs = await BudgetCategoryGroupModel.find({ userId })
        .sort({ order: 1, createdAt: 1 })
        .lean();
      return docs.map((d) => serializeBudgetGroup(d as never));
    }
  );

  // POST /api/budget/groups
  app.post(
    '/api/budget/groups',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const parsed = CreateBudgetGroupRequestSchema.safeParse(request.body);
      if (!parsed.success) return sendValidationError(reply, parsed.error);
      const userId = request.user!._id;

      // Place at end of the current ordering.
      const maxOrder = await BudgetCategoryGroupModel.find({ userId })
        .sort({ order: -1 })
        .limit(1)
        .lean();
      const order = (maxOrder[0]?.order ?? -1) + 1;

      try {
        const doc = await BudgetCategoryGroupModel.create({
          userId: new Types.ObjectId(userId),
          name: parsed.data.name,
          color: parsed.data.color,
          order,
        });
        return reply.code(201).send(serializeBudgetGroup(doc.toObject() as never));
      } catch (err: unknown) {
        if (isDuplicateKey(err)) {
          return reply.code(409).send({
            error: 'duplicate_name',
            message: 'A group with this name already exists.',
          });
        }
        throw err;
      }
    }
  );

  // PATCH /api/budget/groups/reorder — bulk reorder by full id list.
  // Registered BEFORE PATCH /:id so the static route wins find-my-way's
  // matching even when 'reorder' could otherwise be interpreted as an id.
  app.patch(
    '/api/budget/groups/reorder',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const parsed = BudgetReorderRequestSchema.safeParse(request.body);
      if (!parsed.success) return sendValidationError(reply, parsed.error);
      const userId = request.user!._id;

      const existing = await BudgetCategoryGroupModel.find({
        userId,
        archived: false,
      })
        .select('_id')
        .lean();
      const err = validateReorderIds(
        existing.map((d) => String(d._id)),
        parsed.data.ids
      );
      if (err) return reply.code(400).send({ error: err });

      await Promise.all(
        parsed.data.ids.map((id, idx) =>
          BudgetCategoryGroupModel.updateOne(
            { _id: id, userId },
            { $set: { order: idx } }
          )
        )
      );

      const docs = await BudgetCategoryGroupModel.find({
        userId,
        archived: false,
      })
        .sort({ order: 1, createdAt: 1 })
        .lean();
      return docs.map((d) => serializeBudgetGroup(d as never));
    }
  );

  // PATCH /api/budget/groups/:id
  app.patch(
    '/api/budget/groups/:id',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      if (!isObjectId(id)) return reply.code(400).send({ error: 'Invalid id' });
      const parsed = UpdateBudgetGroupRequestSchema.safeParse(request.body);
      if (!parsed.success) return sendValidationError(reply, parsed.error);

      try {
        const doc = await BudgetCategoryGroupModel.findOneAndUpdate(
          { _id: id, userId: request.user!._id },
          { $set: parsed.data },
          { new: true }
        ).lean();
        if (!doc) return reply.code(404).send({ error: 'Not found' });
        return serializeBudgetGroup(doc as never);
      } catch (err) {
        if (isDuplicateKey(err)) {
          return reply.code(409).send({
            error: 'duplicate_name',
            message: 'A group with this name already exists.',
          });
        }
        throw err;
      }
    }
  );

  // DELETE /api/budget/groups/:id  → archive; 409 if live (non-archived) categories
  app.delete(
    '/api/budget/groups/:id',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      if (!isObjectId(id)) return reply.code(400).send({ error: 'Invalid id' });
      const userId = request.user!._id;

      const hasLiveChildren = await BudgetCategoryModel.exists({
        userId,
        groupId: id,
        archived: false,
      });
      if (hasLiveChildren) {
        return reply.code(409).send({
          error: 'group_has_active_categories',
          message:
            'Move or archive this group’s categories before archiving the group.',
        });
      }

      const doc = await BudgetCategoryGroupModel.findOneAndUpdate(
        { _id: id, userId },
        { $set: { archived: true } },
        { new: true }
      ).lean();
      if (!doc) return reply.code(404).send({ error: 'Not found' });
      return serializeBudgetGroup(doc as never);
    }
  );
}

// ---- local helpers ----

function isObjectId(v: string): boolean {
  return /^[a-f\d]{24}$/i.test(v);
}

function isDuplicateKey(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: unknown }).code === 11000
  );
}
