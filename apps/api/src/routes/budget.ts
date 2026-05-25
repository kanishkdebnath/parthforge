import type { FastifyInstance, FastifyReply } from 'fastify';
import { Types } from 'mongoose';
import { z } from 'zod';
import {
  CreateBudgetGroupRequestSchema,
  UpdateBudgetGroupRequestSchema,
  CreateBudgetCategoryRequestSchema,
  UpdateBudgetCategoryRequestSchema,
  CreateBudgetTransactionRequestSchema,
  UpdateBudgetTransactionRequestSchema,
  CreateBudgetRecurringRequestSchema,
  UpdateBudgetRecurringRequestSchema,
  BulkUpsertTargetsRequestSchema,
  BudgetReorderRequestSchema,
  CategoryKindSchema,
  MonthStringSchema,
} from '@pathforge/shared';
import { BudgetCategoryGroupModel } from '../models/BudgetCategoryGroup.js';
import { BudgetCategoryModel } from '../models/BudgetCategory.js';
import { BudgetTransactionModel } from '../models/BudgetTransaction.js';
import { BudgetTargetModel } from '../models/BudgetTarget.js';
import { BudgetRecurringTemplateModel } from '../models/BudgetRecurringTemplate.js';
import { UserModel } from '../models/User.js';
import {
  defaultGroupsSeed,
  defaultCategoriesSeed,
  serializeBudgetGroup,
  serializeBudgetCategory,
  serializeBudgetTransaction,
  serializeBudgetTarget,
  serializeBudgetRecurring,
  monthRangeUtc,
  toIsoMonth,
  buildReportRows,
  totalsFromRows,
  targetTotalsFromRows,
  generateNarrative,
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
            "Move or archive this group's categories before archiving the group.",
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

  // ---- Category routes ----

  // GET /api/budget/categories?groupId=&kind=
  app.get(
    '/api/budget/categories',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const QuerySchema = z.object({
        groupId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
        kind: CategoryKindSchema.optional(),
      });
      const parsed = QuerySchema.safeParse(request.query);
      if (!parsed.success) return sendValidationError(reply, parsed.error);
      const userId = request.user!._id;
      const filter: Record<string, unknown> = { userId };
      if (parsed.data.groupId) filter.groupId = parsed.data.groupId;
      if (parsed.data.kind) filter.kind = parsed.data.kind;
      const docs = await BudgetCategoryModel.find(filter)
        .sort({ groupId: 1, order: 1, createdAt: 1 })
        .lean();
      return docs.map((d) => serializeBudgetCategory(d as never));
    }
  );

  // POST /api/budget/categories
  app.post(
    '/api/budget/categories',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const parsed = CreateBudgetCategoryRequestSchema.safeParse(request.body);
      if (!parsed.success) return sendValidationError(reply, parsed.error);
      const userId = request.user!._id;

      // Group must exist and belong to user.
      const groupExists = await BudgetCategoryGroupModel.exists({
        _id: parsed.data.groupId,
        userId,
      });
      if (!groupExists) {
        return reply.code(400).send({ error: 'invalid_group' });
      }

      const maxOrder = await BudgetCategoryModel.find({
        userId,
        groupId: parsed.data.groupId,
      })
        .sort({ order: -1 })
        .limit(1)
        .lean();
      const order = (maxOrder[0]?.order ?? -1) + 1;

      try {
        const doc = await BudgetCategoryModel.create({
          userId: new Types.ObjectId(userId),
          groupId: new Types.ObjectId(parsed.data.groupId),
          name: parsed.data.name,
          kind: parsed.data.kind,
          color: parsed.data.color,
          order,
        });
        return reply
          .code(201)
          .send(serializeBudgetCategory(doc.toObject() as never));
      } catch (err) {
        if (isDuplicateKey(err)) {
          return reply.code(409).send({
            error: 'duplicate_name',
            message: 'A category with this name already exists.',
          });
        }
        throw err;
      }
    }
  );

  // PATCH /api/budget/categories/reorder — within-group reorder.
  // Registered before PATCH /:id so the static route wins.
  app.patch(
    '/api/budget/categories/reorder',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const BodySchema = z.object({
        groupId: z.string().regex(/^[a-f\d]{24}$/i),
        ids: z.array(z.string().regex(/^[a-f\d]{24}$/i)).min(1),
      });
      const parsed = BodySchema.safeParse(request.body);
      if (!parsed.success) return sendValidationError(reply, parsed.error);
      const userId = request.user!._id;

      // Reorder operates on live categories only — the UI doesn't surface
      // archived items, so a UI-driven reorder set won't include them.
      const existing = await BudgetCategoryModel.find({
        userId,
        groupId: parsed.data.groupId,
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
          BudgetCategoryModel.updateOne(
            { _id: id, userId, groupId: parsed.data.groupId },
            { $set: { order: idx } }
          )
        )
      );

      const docs = await BudgetCategoryModel.find({
        userId,
        groupId: parsed.data.groupId,
        archived: false,
      })
        .sort({ order: 1, createdAt: 1 })
        .lean();
      return docs.map((d) => serializeBudgetCategory(d as never));
    }
  );

  // PATCH /api/budget/categories/:id
  app.patch(
    '/api/budget/categories/:id',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      if (!isObjectId(id)) return reply.code(400).send({ error: 'Invalid id' });
      const parsed = UpdateBudgetCategoryRequestSchema.safeParse(request.body);
      if (!parsed.success) return sendValidationError(reply, parsed.error);
      const userId = request.user!._id;

      if (parsed.data.groupId) {
        const groupExists = await BudgetCategoryGroupModel.exists({
          _id: parsed.data.groupId,
          userId,
        });
        if (!groupExists) {
          return reply.code(400).send({ error: 'invalid_group' });
        }
      }

      const $set: Record<string, unknown> = {};
      const $unset: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(parsed.data)) {
        if (v === null) $unset[k] = '';
        else if (v !== undefined) $set[k] = v;
      }
      const update: Record<string, unknown> = {};
      if (Object.keys($set).length) update.$set = $set;
      if (Object.keys($unset).length) update.$unset = $unset;

      try {
        const doc = await BudgetCategoryModel.findOneAndUpdate(
          { _id: id, userId },
          update,
          { new: true }
        ).lean();
        if (!doc) return reply.code(404).send({ error: 'Not found' });
        return serializeBudgetCategory(doc as never);
      } catch (err) {
        if (isDuplicateKey(err)) {
          return reply.code(409).send({ error: 'duplicate_name' });
        }
        throw err;
      }
    }
  );

  // DELETE /api/budget/categories/:id  → archive only (history preservation)
  app.delete(
    '/api/budget/categories/:id',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      if (!isObjectId(id)) return reply.code(400).send({ error: 'Invalid id' });
      const doc = await BudgetCategoryModel.findOneAndUpdate(
        { _id: id, userId: request.user!._id },
        { $set: { archived: true } },
        { new: true }
      ).lean();
      if (!doc) return reply.code(404).send({ error: 'Not found' });
      return serializeBudgetCategory(doc as never);
    }
  );

  // ---- Transaction routes ----

  // GET /api/budget/transactions?month=YYYY-MM
  app.get(
    '/api/budget/transactions',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const QuerySchema = z.object({
        month: MonthStringSchema.optional(),
      });
      const parsed = QuerySchema.safeParse(request.query);
      if (!parsed.success) return sendValidationError(reply, parsed.error);
      const userId = request.user!._id;
      const month = parsed.data.month ?? defaultCurrentMonth();
      const { start, endExclusive } = monthRangeUtc(month);
      const docs = await BudgetTransactionModel.find({
        userId,
        date: { $gte: start, $lt: endExclusive },
      })
        .sort({ date: -1, createdAt: -1 })
        .lean();
      return docs.map((d) => serializeBudgetTransaction(d as never));
    }
  );

  // POST /api/budget/transactions
  app.post(
    '/api/budget/transactions',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const parsed = CreateBudgetTransactionRequestSchema.safeParse(request.body);
      if (!parsed.success) return sendValidationError(reply, parsed.error);
      const userId = request.user!._id;

      const categoryExists = await BudgetCategoryModel.exists({
        _id: parsed.data.categoryId,
        userId,
      });
      if (!categoryExists) {
        return reply.code(400).send({ error: 'invalid_category' });
      }

      const doc = await BudgetTransactionModel.create({
        userId: new Types.ObjectId(userId),
        date: parsed.data.date,
        categoryId: new Types.ObjectId(parsed.data.categoryId),
        amount: parsed.data.amount,
        description: parsed.data.description,
      });
      return reply
        .code(201)
        .send(serializeBudgetTransaction(doc.toObject() as never));
    }
  );

  // PATCH /api/budget/transactions/:id
  app.patch(
    '/api/budget/transactions/:id',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      if (!isObjectId(id)) return reply.code(400).send({ error: 'Invalid id' });
      const parsed = UpdateBudgetTransactionRequestSchema.safeParse(request.body);
      if (!parsed.success) return sendValidationError(reply, parsed.error);
      const userId = request.user!._id;

      if (parsed.data.categoryId) {
        const categoryExists = await BudgetCategoryModel.exists({
          _id: parsed.data.categoryId,
          userId,
        });
        if (!categoryExists) {
          return reply.code(400).send({ error: 'invalid_category' });
        }
      }

      const $set: Record<string, unknown> = {};
      const $unset: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(parsed.data)) {
        if (v === null) $unset[k] = '';
        else if (v !== undefined) $set[k] = v;
      }
      const update: Record<string, unknown> = {};
      if (Object.keys($set).length) update.$set = $set;
      if (Object.keys($unset).length) update.$unset = $unset;

      const doc = await BudgetTransactionModel.findOneAndUpdate(
        { _id: id, userId },
        update,
        { new: true }
      ).lean();
      if (!doc) return reply.code(404).send({ error: 'Not found' });
      return serializeBudgetTransaction(doc as never);
    }
  );

  // DELETE /api/budget/transactions/:id  → hard delete (transactions aren't soft-deleted)
  app.delete(
    '/api/budget/transactions/:id',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      if (!isObjectId(id)) return reply.code(400).send({ error: 'Invalid id' });
      const doc = await BudgetTransactionModel.findOneAndDelete({
        _id: id,
        userId: request.user!._id,
      }).lean();
      if (!doc) return reply.code(404).send({ error: 'Not found' });
      return { ok: true };
    }
  );

  // ---- Target routes ----

  // GET /api/budget/targets?month=YYYY-MM
  app.get(
    '/api/budget/targets',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const QuerySchema = z.object({ month: MonthStringSchema });
      const parsed = QuerySchema.safeParse(request.query);
      if (!parsed.success) return sendValidationError(reply, parsed.error);
      const userId = request.user!._id;
      const docs = await BudgetTargetModel.find({
        userId,
        month: parsed.data.month,
      }).lean();
      return docs.map((d) => serializeBudgetTarget(d as never));
    }
  );

  // PUT /api/budget/targets — bulk upsert for a month
  app.put(
    '/api/budget/targets',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const parsed = BulkUpsertTargetsRequestSchema.safeParse(request.body);
      if (!parsed.success) return sendValidationError(reply, parsed.error);
      const userId = request.user!._id;
      const { month, items } = parsed.data;

      // Validate every categoryId belongs to user.
      const categoryIds = items.map((i) => i.categoryId);
      if (categoryIds.length > 0) {
        const owned = await BudgetCategoryModel.countDocuments({
          userId,
          _id: { $in: categoryIds },
        });
        if (owned !== new Set(categoryIds).size) {
          return reply.code(400).send({ error: 'invalid_category' });
        }
      }

      // Upsert each sequentially to avoid hammering Mongo with parallel
      // upserts on the same (userId, month) index slice.
      for (const item of items) {
        await BudgetTargetModel.updateOne(
          { userId, month, categoryId: item.categoryId },
          {
            $set: { amount: item.amount },
            $setOnInsert: {
              userId: new Types.ObjectId(userId),
              categoryId: new Types.ObjectId(item.categoryId),
              month,
            },
          },
          { upsert: true }
        );
      }

      const docs = await BudgetTargetModel.find({ userId, month }).lean();
      return docs.map((d) => serializeBudgetTarget(d as never));
    }
  );

  // DELETE /api/budget/targets/:id — hard delete a single target
  app.delete(
    '/api/budget/targets/:id',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      if (!isObjectId(id)) return reply.code(400).send({ error: 'Invalid id' });
      const doc = await BudgetTargetModel.findOneAndDelete({
        _id: id,
        userId: request.user!._id,
      }).lean();
      if (!doc) return reply.code(404).send({ error: 'Not found' });
      return { ok: true };
    }
  );

  // ---- Recurring template routes ----

  // GET /api/budget/recurring
  app.get(
    '/api/budget/recurring',
    { preHandler: [app.authenticate] },
    async (request) => {
      const userId = request.user!._id;
      const docs = await BudgetRecurringTemplateModel.find({ userId })
        .sort({ active: -1, createdAt: 1 })
        .lean();
      return docs.map((d) => serializeBudgetRecurring(d as never));
    }
  );

  // POST /api/budget/recurring
  app.post(
    '/api/budget/recurring',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const parsed = CreateBudgetRecurringRequestSchema.safeParse(request.body);
      if (!parsed.success) return sendValidationError(reply, parsed.error);
      const userId = request.user!._id;

      const categoryExists = await BudgetCategoryModel.exists({
        _id: parsed.data.categoryId,
        userId,
      });
      if (!categoryExists) {
        return reply.code(400).send({ error: 'invalid_category' });
      }

      const doc = await BudgetRecurringTemplateModel.create({
        userId: new Types.ObjectId(userId),
        label: parsed.data.label,
        categoryId: new Types.ObjectId(parsed.data.categoryId),
        amount: parsed.data.amount,
        cadence: 'monthly',
        dayOfMonth: parsed.data.dayOfMonth,
        active: parsed.data.active ?? true,
      });
      return reply
        .code(201)
        .send(serializeBudgetRecurring(doc.toObject() as never));
    }
  );

  // PATCH /api/budget/recurring/:id
  app.patch(
    '/api/budget/recurring/:id',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      if (!isObjectId(id)) return reply.code(400).send({ error: 'Invalid id' });
      const parsed = UpdateBudgetRecurringRequestSchema.safeParse(request.body);
      if (!parsed.success) return sendValidationError(reply, parsed.error);
      const userId = request.user!._id;

      if (parsed.data.categoryId) {
        const ok = await BudgetCategoryModel.exists({
          _id: parsed.data.categoryId,
          userId,
        });
        if (!ok) return reply.code(400).send({ error: 'invalid_category' });
      }

      const doc = await BudgetRecurringTemplateModel.findOneAndUpdate(
        { _id: id, userId },
        { $set: parsed.data },
        { new: true }
      ).lean();
      if (!doc) return reply.code(404).send({ error: 'Not found' });
      return serializeBudgetRecurring(doc as never);
    }
  );

  // DELETE /api/budget/recurring/:id  → hard delete
  app.delete(
    '/api/budget/recurring/:id',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      if (!isObjectId(id)) return reply.code(400).send({ error: 'Invalid id' });
      const doc = await BudgetRecurringTemplateModel.findOneAndDelete({
        _id: id,
        userId: request.user!._id,
      }).lean();
      if (!doc) return reply.code(404).send({ error: 'Not found' });
      return { ok: true };
    }
  );

  // POST /api/budget/recurring/:id/apply
  // 404 if template doesn't exist or doesn't belong to user.
  // 409 'template_inactive' if !active. 409 'already_applied' if
  // lastRunMonth === currentMonth.
  //
  // Race-safe: the lastRunMonth flip happens atomically via
  // findOneAndUpdate with `lastRunMonth: { $ne: month }` in the filter.
  // Only the request that actually claims the month proceeds to create
  // the transaction; simultaneous duplicate applies fall through to the
  // 409 branch. If the subsequent transaction insert fails, the
  // lastRunMonth flip is rolled back so the user can retry.
  app.post(
    '/api/budget/recurring/:id/apply',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      if (!isObjectId(id)) return reply.code(400).send({ error: 'Invalid id' });
      const userId = request.user!._id;
      const month = defaultCurrentMonth();

      // Atomic claim: only the request that flips lastRunMonth wins.
      // `{ $ne: month }` matches docs whose field is missing or has a
      // different value — both are valid "not yet applied" states.
      const claimed = await BudgetRecurringTemplateModel.findOneAndUpdate(
        {
          _id: id,
          userId,
          active: true,
          lastRunMonth: { $ne: month },
        },
        { $set: { lastRunMonth: month } },
        { new: false } // return the pre-update doc so we have the prior lastRunMonth for rollback
      );

      if (!claimed) {
        // The atomic filter didn't match. Disambiguate the failure mode
        // so the client gets a useful 404 or 409.
        const existing = await BudgetRecurringTemplateModel.findOne({
          _id: id,
          userId,
        }).lean();
        if (!existing) return reply.code(404).send({ error: 'Not found' });
        if (!existing.active) {
          return reply.code(409).send({ error: 'template_inactive' });
        }
        // active && lastRunMonth === month
        return reply.code(409).send({
          error: 'already_applied',
          lastRunMonth: existing.lastRunMonth,
        });
      }

      // Date for the transaction: dayOfMonth of the current month at 09:00 UTC.
      // Hour chosen to be unambiguously "this day" across most user timezones.
      const parts = month.split('-');
      const y = Number(parts[0]!);
      const m = Number(parts[1]!);
      const date = new Date(Date.UTC(y, m - 1, claimed.dayOfMonth, 9, 0, 0, 0));

      try {
        const txn = await BudgetTransactionModel.create({
          userId: new Types.ObjectId(userId),
          date,
          categoryId: claimed.categoryId,
          amount: claimed.amount,
          description: claimed.label,
          recurringTemplateId: claimed._id,
        });
        return reply
          .code(201)
          .send(serializeBudgetTransaction(txn.toObject() as never));
      } catch (err) {
        // Roll back the lastRunMonth flip so a retry can succeed.
        // Restore the prior value, or unset if it was missing.
        const rollback = claimed.lastRunMonth
          ? { $set: { lastRunMonth: claimed.lastRunMonth } }
          : { $unset: { lastRunMonth: '' } };
        await BudgetRecurringTemplateModel.updateOne(
          { _id: id, userId },
          rollback
        );
        throw err;
      }
    }
  );

  // GET /api/budget/report?month=YYYY-MM
  // Single round-trip aggregation: returns groups+categories+totals+narrative
  // for the frontend report page and the dashboard widget.
  app.get(
    '/api/budget/report',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const QuerySchema = z.object({
        month: MonthStringSchema.optional(),
      });
      const parsed = QuerySchema.safeParse(request.query);
      if (!parsed.success) return sendValidationError(reply, parsed.error);
      const userId = request.user!._id;
      const month = parsed.data.month ?? defaultCurrentMonth();
      const { start, endExclusive } = monthRangeUtc(month);

      const [groups, categories, transactions, targets, recurring, userDoc] =
        await Promise.all([
          BudgetCategoryGroupModel.find({ userId })
            .sort({ order: 1, createdAt: 1 })
            .lean(),
          BudgetCategoryModel.find({ userId })
            .sort({ groupId: 1, order: 1 })
            .lean(),
          BudgetTransactionModel.find({
            userId,
            date: { $gte: start, $lt: endExclusive },
          }).lean(),
          BudgetTargetModel.find({ userId, month }).lean(),
          BudgetRecurringTemplateModel.find({ userId, active: true }).lean(),
          UserModel.findById(userId).select('currency').lean(),
        ]);

      const rows = buildReportRows({
        groups: groups as never,
        categories: categories as never,
        transactions: transactions as never,
        targets: targets as never,
      });
      const totals = totalsFromRows(rows);
      const targetTotals = targetTotalsFromRows(rows);
      const currency = (userDoc?.currency as string | undefined) ?? 'INR';

      const expenseGroups = rows.filter((r) => r.kind === 'expense');
      const narrative = generateNarrative({
        month,
        currency: currency as never,
        expenseActual: totals.expense,
        expenseTarget: targetTotals.expense,
        hasAnyTarget: targets.length > 0,
        hasAnyTransaction: transactions.length > 0,
        expenseGroups,
      });

      const recurringDue = recurring
        .filter((r) => r.lastRunMonth !== month)
        .map((r) => ({
          templateId: String(r._id),
          label: r.label,
          amount: r.amount,
          dayOfMonth: r.dayOfMonth,
        }));

      return {
        month,
        currency,
        totals,
        targetTotals,
        groups: rows,
        narrative,
        recurringDue,
      };
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

function defaultCurrentMonth(): string {
  return toIsoMonth(new Date());
}
