# Budget — Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the backend half of the Budget feature: shared Zod schemas for the budget domain plus a `currency` field on the User, five new Mongoose models, helpers (serializers, month derivation, narrative generator, seeding), ~22 REST endpoints under `/api/budget`, an extension to `PATCH /api/auth/me` for currency, and smoke + helper + schema tests. The frontend is planned in a separate follow-up.

**Architecture:** Mirrors the existing `roadmaps`/`jobs`/`journal` features. Five new collections (`budgetCategoryGroups`, `budgetCategories`, `budgetTargets`, `budgetTransactions`, `budgetRecurringTemplates`) each carry `userId`. All routes go through the existing `app.authenticate` preHandler and scope queries by `req.user!._id`. Money is stored as integer minor units (paise/cents). Months are `YYYY-MM` strings; transaction month is derived in queries from `date`. Default groups + categories seed transactionally on the first `GET /api/budget/groups` for a user with zero groups.

**Tech Stack:** Fastify, Mongoose, Zod, Vitest. TypeScript throughout. Reuses the existing auth plugin (`request.user!._id`), `buildApp({ skipDb: true })` test harness, `validateReorderIds` helper, and `@pathforge/shared` workspace package.

**Spec:** [docs/superpowers/specs/2026-05-22-budget-feature-design.md](../specs/2026-05-22-budget-feature-design.md)

---

## File Map

**Create:**
- `packages/shared/src/budget.ts` — Zod schemas + inferred types for groups, categories, targets, transactions, recurring templates; all Create/Update/Reorder request shapes; the ISO 4217 currency-code Zod schema.
- `apps/api/src/models/BudgetCategoryGroup.ts` — Mongoose model + indexes.
- `apps/api/src/models/BudgetCategory.ts` — Mongoose model + indexes.
- `apps/api/src/models/BudgetTarget.ts` — Mongoose model + unique compound index.
- `apps/api/src/models/BudgetTransaction.ts` — Mongoose model + indexes.
- `apps/api/src/models/BudgetRecurringTemplate.ts` — Mongoose model + indexes.
- `apps/api/src/lib/budget-helpers.ts` — Serializers, month derivation, default-seed payloads, narrative generator.
- `apps/api/src/routes/budget.ts` — All `/api/budget/*` handlers.
- `apps/api/test/budget-schema.test.ts` — Zod round-trip tests for the trickier schemas (month regex, amount cap, currency, color, kind/category coherence).
- `apps/api/test/budget-helpers.test.ts` — Unit tests for serializers, month derivation, narrative generator.
- `apps/api/test/budget.test.ts` — Smoke test confirming each endpoint 401s without a session cookie.

**Modify:**
- `packages/shared/src/index.ts` — add `export * from './budget.js';`.
- `packages/shared/src/user.ts` — add `currency` to `UserSchema` and to `UpdateMeRequestSchema`.
- `apps/api/src/models/User.ts` — add `currency` field with default `'INR'`.
- `apps/api/src/plugins/auth.ts` — hydrate `request.user.currency`.
- `apps/api/src/routes/auth.ts` — include `currency` in the GET `/api/auth/me` response and extend the PATCH `/api/auth/me` handler to persist currency updates.
- `apps/api/test/user-schema.test.ts` — add currency assertions.
- `apps/api/test/auth-patch-me.test.ts` — add a 401-without-session assertion for the currency-only payload (smoke parity).
- `apps/api/src/server.ts` — register `budgetRoutes`.

**Out of scope (deferred to the frontend plan):**
- Any `apps/web/**` changes.
- CSV/statement import, bank integrations.
- Cross-feature linking (category ↔ roadmap, transaction ↔ milestone).

---

## Task Conventions

- Steps marked `[Read first]` are orientation reads. Skip if you've already absorbed the file.
- All `Run` commands are from the repo root (`/Users/kanishkdebnath/Developer/pathforge`).
- Type-check the package you changed before committing: `npm -w api run typecheck` and/or `npm -w @pathforge/shared run build` (whichever applies). Tests: `npm -w api test -- --run` for one-shot.
- Commit at the end of each task with the project's existing tone: `feat(api): …`, `chore(shared): …`, `test(api): …`.
- `request.user!._id` is the userId convention. Never read `userId` from the body.
- Amounts in storage and over the wire are integer minor units (paise for INR). UI converts at the edge.
- Months are `YYYY-MM` strings. Transaction `date` is a full `Date`. Derive month from date via `toIsoMonth(date)` (helper added in Task 4).

---

## Task 1 — Shared schemas (budget domain)

**Files:**
- Create: `packages/shared/src/budget.ts`
- Modify: `packages/shared/src/index.ts`
- Create: `apps/api/test/budget-schema.test.ts`

- [ ] **Step 1: [Read first] Skim existing shared schemas for conventions**

Read `packages/shared/src/jobApplication.ts` (request/response split, `ObjectIdString` usage, `nullable().optional()` patch pattern) and `packages/shared/src/journalDay.ts` (`DateStringSchema` regex pattern, discriminated unions).

- [ ] **Step 2: Create `packages/shared/src/budget.ts`**

Create with exact content:

```typescript
import { z } from 'zod';
import { ObjectIdString } from './objectId.js';

// ---- Primitive schemas ----

/**
 * Common ISO 4217 codes surfaced in the UI's top-of-list. The server accepts
 * any 3-letter uppercase code, but this whitelist is the only set the picker
 * promotes; everything else falls under "Other" in the UI. Conservative on
 * purpose — no need to ship a 180-entry currency table for v1.
 */
export const COMMON_CURRENCIES = [
  'INR', 'USD', 'EUR', 'GBP', 'AUD', 'CAD', 'SGD', 'JPY',
] as const;

export const CurrencyCodeSchema = z
  .string()
  .regex(/^[A-Z]{3}$/, 'Currency must be a 3-letter ISO 4217 code');
export type CurrencyCode = z.infer<typeof CurrencyCodeSchema>;

/** `YYYY-MM` with a real month. */
export const MonthStringSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Month must be YYYY-MM');
export type MonthString = z.infer<typeof MonthStringSchema>;

/** Positive integer minor units, capped at 10^12 (~₹10 billion). */
export const MoneyAmountSchema = z
  .number()
  .int('Amount must be an integer (minor units)')
  .min(0, 'Amount must be ≥ 0')
  .max(1_000_000_000_000, 'Amount exceeds maximum (10^12 minor units)');
export type MoneyAmount = z.infer<typeof MoneyAmountSchema>;

/** 6-char hex with leading '#'. */
export const HexColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Color must be a 6-char hex with leading #');
export type HexColor = z.infer<typeof HexColorSchema>;

export const CategoryKindSchema = z.enum(['income', 'expense']);
export type CategoryKind = z.infer<typeof CategoryKindSchema>;

export const CadenceSchema = z.literal('monthly');
export type Cadence = z.infer<typeof CadenceSchema>;

// ---- Domain schemas ----

export const BudgetCategoryGroupSchema = z.object({
  _id: ObjectIdString,
  userId: ObjectIdString,
  name: z.string().min(1).max(80),
  color: HexColorSchema,
  order: z.number().int().min(0),
  archived: z.boolean().default(false),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type BudgetCategoryGroup = z.infer<typeof BudgetCategoryGroupSchema>;

export const BudgetCategorySchema = z.object({
  _id: ObjectIdString,
  userId: ObjectIdString,
  groupId: ObjectIdString,
  name: z.string().min(1).max(80),
  kind: CategoryKindSchema,
  color: HexColorSchema.optional(),
  order: z.number().int().min(0),
  archived: z.boolean().default(false),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type BudgetCategory = z.infer<typeof BudgetCategorySchema>;

export const BudgetTargetSchema = z.object({
  _id: ObjectIdString,
  userId: ObjectIdString,
  categoryId: ObjectIdString,
  month: MonthStringSchema,
  amount: MoneyAmountSchema,
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type BudgetTarget = z.infer<typeof BudgetTargetSchema>;

export const BudgetTransactionSchema = z.object({
  _id: ObjectIdString,
  userId: ObjectIdString,
  date: z.coerce.date(),
  categoryId: ObjectIdString,
  amount: MoneyAmountSchema,
  description: z.string().max(500).optional(),
  recurringTemplateId: ObjectIdString.optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type BudgetTransaction = z.infer<typeof BudgetTransactionSchema>;

export const BudgetRecurringTemplateSchema = z.object({
  _id: ObjectIdString,
  userId: ObjectIdString,
  label: z.string().min(1).max(120),
  categoryId: ObjectIdString,
  amount: MoneyAmountSchema,
  cadence: CadenceSchema,
  dayOfMonth: z.number().int().min(1).max(28),
  lastRunMonth: MonthStringSchema.optional(),
  active: z.boolean().default(true),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type BudgetRecurringTemplate = z.infer<typeof BudgetRecurringTemplateSchema>;

// ---- Request shapes (Create / Update / bulk Reorder / bulk PUT targets) ----

export const CreateBudgetGroupRequestSchema = z.object({
  name: z.string().min(1).max(80),
  color: HexColorSchema,
});
export type CreateBudgetGroupRequest = z.infer<typeof CreateBudgetGroupRequestSchema>;

export const UpdateBudgetGroupRequestSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  color: HexColorSchema.optional(),
  archived: z.boolean().optional(),
});
export type UpdateBudgetGroupRequest = z.infer<typeof UpdateBudgetGroupRequestSchema>;

export const CreateBudgetCategoryRequestSchema = z.object({
  groupId: ObjectIdString,
  name: z.string().min(1).max(80),
  kind: CategoryKindSchema,
  color: HexColorSchema.optional(),
});
export type CreateBudgetCategoryRequest = z.infer<typeof CreateBudgetCategoryRequestSchema>;

export const UpdateBudgetCategoryRequestSchema = z.object({
  groupId: ObjectIdString.optional(),
  name: z.string().min(1).max(80).optional(),
  kind: CategoryKindSchema.optional(),
  color: HexColorSchema.nullable().optional(),
  archived: z.boolean().optional(),
});
export type UpdateBudgetCategoryRequest = z.infer<typeof UpdateBudgetCategoryRequestSchema>;

export const ReorderRequestSchema = z.object({
  ids: z.array(ObjectIdString).min(1),
});
export type ReorderRequest = z.infer<typeof ReorderRequestSchema>;

export const CreateBudgetTransactionRequestSchema = z.object({
  date: z.coerce.date(),
  categoryId: ObjectIdString,
  amount: MoneyAmountSchema,
  description: z.string().max(500).optional(),
});
export type CreateBudgetTransactionRequest = z.infer<typeof CreateBudgetTransactionRequestSchema>;

export const UpdateBudgetTransactionRequestSchema = z.object({
  date: z.coerce.date().optional(),
  categoryId: ObjectIdString.optional(),
  amount: MoneyAmountSchema.optional(),
  description: z.string().max(500).nullable().optional(),
});
export type UpdateBudgetTransactionRequest = z.infer<typeof UpdateBudgetTransactionRequestSchema>;

export const BulkUpsertTargetsRequestSchema = z.object({
  month: MonthStringSchema,
  items: z
    .array(
      z.object({
        categoryId: ObjectIdString,
        amount: MoneyAmountSchema,
      })
    )
    .min(0)
    .max(200),
});
export type BulkUpsertTargetsRequest = z.infer<typeof BulkUpsertTargetsRequestSchema>;

export const CreateBudgetRecurringRequestSchema = z.object({
  label: z.string().min(1).max(120),
  categoryId: ObjectIdString,
  amount: MoneyAmountSchema,
  cadence: CadenceSchema,
  dayOfMonth: z.number().int().min(1).max(28),
  active: z.boolean().optional(),
});
export type CreateBudgetRecurringRequest = z.infer<typeof CreateBudgetRecurringRequestSchema>;

export const UpdateBudgetRecurringRequestSchema = z.object({
  label: z.string().min(1).max(120).optional(),
  categoryId: ObjectIdString.optional(),
  amount: MoneyAmountSchema.optional(),
  dayOfMonth: z.number().int().min(1).max(28).optional(),
  active: z.boolean().optional(),
});
export type UpdateBudgetRecurringRequest = z.infer<typeof UpdateBudgetRecurringRequestSchema>;

// ---- Report response shape (server returns this; clients import the type) ----

export const BudgetReportCategoryRowSchema = z.object({
  categoryId: ObjectIdString,
  name: z.string(),
  actual: MoneyAmountSchema,
  target: MoneyAmountSchema,
  delta: z.number().int(),
});
export type BudgetReportCategoryRow = z.infer<typeof BudgetReportCategoryRowSchema>;

export const BudgetReportGroupRowSchema = z.object({
  groupId: ObjectIdString,
  name: z.string(),
  kind: CategoryKindSchema,
  actual: MoneyAmountSchema,
  target: MoneyAmountSchema,
  delta: z.number().int(),
  categories: z.array(BudgetReportCategoryRowSchema),
});
export type BudgetReportGroupRow = z.infer<typeof BudgetReportGroupRowSchema>;

export const BudgetReportSchema = z.object({
  month: MonthStringSchema,
  currency: CurrencyCodeSchema,
  totals: z.object({
    income: MoneyAmountSchema,
    expense: MoneyAmountSchema,
    net: z.number().int(),
  }),
  targetTotals: z.object({
    income: MoneyAmountSchema,
    expense: MoneyAmountSchema,
    net: z.number().int(),
  }),
  groups: z.array(BudgetReportGroupRowSchema),
  narrative: z.string(),
  recurringDue: z.array(
    z.object({
      templateId: ObjectIdString,
      label: z.string(),
      amount: MoneyAmountSchema,
      dayOfMonth: z.number().int(),
    })
  ),
});
export type BudgetReport = z.infer<typeof BudgetReportSchema>;
```

- [ ] **Step 3: Re-export from the package barrel**

Edit `packages/shared/src/index.ts` and append a new line so the file ends with:

```typescript
export * from './user.js';
export * from './link.js';
export * from './objectId.js';
export * from './roadmap.js';
export * from './jobApplication.js';
export * from './journalDay.js';
export * from './budget.js';
```

- [ ] **Step 4: Build the shared package and verify**

Run: `npm -w @pathforge/shared run build`
Expected: completes without errors.

- [ ] **Step 5: Create the schema round-trip test**

Create `apps/api/test/budget-schema.test.ts` with exact content:

```typescript
import { describe, it, expect } from 'vitest';
import {
  MonthStringSchema,
  MoneyAmountSchema,
  HexColorSchema,
  CurrencyCodeSchema,
  BudgetTransactionSchema,
  CreateBudgetTransactionRequestSchema,
  BulkUpsertTargetsRequestSchema,
  CreateBudgetRecurringRequestSchema,
} from '@pathforge/shared';

describe('MonthStringSchema', () => {
  it('accepts valid months', () => {
    expect(MonthStringSchema.safeParse('2026-05').success).toBe(true);
    expect(MonthStringSchema.safeParse('2026-01').success).toBe(true);
    expect(MonthStringSchema.safeParse('2026-12').success).toBe(true);
  });
  it('rejects month 00 and 13', () => {
    expect(MonthStringSchema.safeParse('2026-00').success).toBe(false);
    expect(MonthStringSchema.safeParse('2026-13').success).toBe(false);
  });
  it('rejects malformed strings', () => {
    expect(MonthStringSchema.safeParse('2026-5').success).toBe(false);
    expect(MonthStringSchema.safeParse('2026/05').success).toBe(false);
    expect(MonthStringSchema.safeParse('May 2026').success).toBe(false);
  });
});

describe('MoneyAmountSchema', () => {
  it('accepts zero and positive integers', () => {
    expect(MoneyAmountSchema.safeParse(0).success).toBe(true);
    expect(MoneyAmountSchema.safeParse(1).success).toBe(true);
    expect(MoneyAmountSchema.safeParse(100_000).success).toBe(true);
  });
  it('rejects negative', () => {
    expect(MoneyAmountSchema.safeParse(-1).success).toBe(false);
  });
  it('rejects non-integers', () => {
    expect(MoneyAmountSchema.safeParse(1.5).success).toBe(false);
  });
  it('rejects values above 10^12', () => {
    expect(MoneyAmountSchema.safeParse(1_000_000_000_001).success).toBe(false);
  });
});

describe('HexColorSchema', () => {
  it('accepts 6-char hex with #', () => {
    expect(HexColorSchema.safeParse('#aabbcc').success).toBe(true);
    expect(HexColorSchema.safeParse('#FFFFFF').success).toBe(true);
  });
  it('rejects without #', () => {
    expect(HexColorSchema.safeParse('aabbcc').success).toBe(false);
  });
  it('rejects 3-char short form', () => {
    expect(HexColorSchema.safeParse('#abc').success).toBe(false);
  });
});

describe('CurrencyCodeSchema', () => {
  it('accepts 3-letter uppercase codes', () => {
    expect(CurrencyCodeSchema.safeParse('INR').success).toBe(true);
    expect(CurrencyCodeSchema.safeParse('USD').success).toBe(true);
  });
  it('rejects lowercase / 2-letter / 4-letter codes', () => {
    expect(CurrencyCodeSchema.safeParse('inr').success).toBe(false);
    expect(CurrencyCodeSchema.safeParse('IN').success).toBe(false);
    expect(CurrencyCodeSchema.safeParse('INRA').success).toBe(false);
  });
});

describe('CreateBudgetTransactionRequestSchema', () => {
  it('accepts a minimal transaction', () => {
    expect(
      CreateBudgetTransactionRequestSchema.safeParse({
        date: '2026-05-22T10:00:00Z',
        categoryId: '507f1f77bcf86cd799439011',
        amount: 50_000,
      }).success
    ).toBe(true);
  });
  it('rejects negative amount', () => {
    expect(
      CreateBudgetTransactionRequestSchema.safeParse({
        date: '2026-05-22T10:00:00Z',
        categoryId: '507f1f77bcf86cd799439011',
        amount: -1,
      }).success
    ).toBe(false);
  });
  it('rejects description > 500 chars', () => {
    expect(
      CreateBudgetTransactionRequestSchema.safeParse({
        date: '2026-05-22T10:00:00Z',
        categoryId: '507f1f77bcf86cd799439011',
        amount: 100,
        description: 'x'.repeat(501),
      }).success
    ).toBe(false);
  });
});

describe('BulkUpsertTargetsRequestSchema', () => {
  it('accepts an empty items array (clear all)', () => {
    expect(
      BulkUpsertTargetsRequestSchema.safeParse({
        month: '2026-05',
        items: [],
      }).success
    ).toBe(true);
  });
  it('rejects more than 200 items', () => {
    const items = Array.from({ length: 201 }, () => ({
      categoryId: '507f1f77bcf86cd799439011',
      amount: 100,
    }));
    expect(
      BulkUpsertTargetsRequestSchema.safeParse({ month: '2026-05', items }).success
    ).toBe(false);
  });
});

describe('CreateBudgetRecurringRequestSchema', () => {
  it('accepts dayOfMonth 1-28', () => {
    for (const d of [1, 15, 28]) {
      expect(
        CreateBudgetRecurringRequestSchema.safeParse({
          label: 'Rent',
          categoryId: '507f1f77bcf86cd799439011',
          amount: 1_800_000,
          cadence: 'monthly',
          dayOfMonth: d,
        }).success
      ).toBe(true);
    }
  });
  it('rejects dayOfMonth 0 or 29+', () => {
    for (const d of [0, 29, 30, 31]) {
      expect(
        CreateBudgetRecurringRequestSchema.safeParse({
          label: 'Rent',
          categoryId: '507f1f77bcf86cd799439011',
          amount: 1_800_000,
          cadence: 'monthly',
          dayOfMonth: d,
        }).success
      ).toBe(false);
    }
  });
});
```

- [ ] **Step 6: Run schema tests**

Run: `npm -w api test -- --run budget-schema`
Expected: all tests pass.

- [ ] **Step 7: Commit**

Run:
```bash
git add packages/shared/src/budget.ts packages/shared/src/index.ts apps/api/test/budget-schema.test.ts
git commit -m "$(cat <<'EOF'
chore(shared): add budget domain schemas

Defines Zod schemas + inferred types for the four Budget collections
plus their Create/Update/Reorder request shapes. Adds shared primitive
schemas (MonthStringSchema, MoneyAmountSchema, HexColorSchema,
CurrencyCodeSchema) and the BudgetReport response shape consumed by
the report endpoint. Schema round-trip tests cover the trickier edges.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2 — User: currency field (shared schema, model, auth hydration, PATCH /me)

**Files:**
- Modify: `packages/shared/src/user.ts`
- Modify: `apps/api/src/models/User.ts`
- Modify: `apps/api/src/plugins/auth.ts`
- Modify: `apps/api/src/routes/auth.ts`
- Modify: `apps/api/test/user-schema.test.ts`

- [ ] **Step 1: [Read first] Re-read the existing User surface**

Read `packages/shared/src/user.ts`, `apps/api/src/models/User.ts`, `apps/api/src/plugins/auth.ts`, the `PATCH /api/auth/me` handler in `apps/api/src/routes/auth.ts`, and `apps/api/test/user-schema.test.ts`.

- [ ] **Step 2: Extend `UserSchema` and `UpdateMeRequestSchema` in `packages/shared/src/user.ts`**

Edit `packages/shared/src/user.ts` and add `CurrencyCodeSchema` import + a `currency` field on both schemas. Final file:

```typescript
import { z } from 'zod';
import { CurrencyCodeSchema } from './budget.js';

export const UserSchema = z.object({
  _id: z.string(),
  email: z.string().email(),
  name: z.string().min(1),
  avatarUrl: z.string().url().optional(),
  googleId: z.string().optional(),
  isDemoUser: z.boolean().optional(),
  timezone: z.string().min(1).max(80).optional(),
  // ISO 4217. Server defaults to 'INR' on creation and on the GET /me
  // response if the underlying doc lacks the field (pre-migration users).
  currency: CurrencyCodeSchema.optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type User = z.infer<typeof UserSchema>;

export const LoginRequestSchema = z.object({
  userId: z.string().regex(/^[a-f\d]{24}$/i),
  clientToday: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/)
    .optional(),
});

export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const DevUserSchema = UserSchema.pick({
  _id: true,
  email: true,
  name: true,
  avatarUrl: true,
  isDemoUser: true,
});

export type DevUser = z.infer<typeof DevUserSchema>;

// Profile self-update. Null clears a field where allowed; undefined leaves
// it alone. Currency is not nullable — every user has a currency, even if
// the field was absent on legacy docs.
export const UpdateMeRequestSchema = z.object({
  timezone: z.string().min(1).max(80).nullable().optional(),
  currency: CurrencyCodeSchema.optional(),
});
export type UpdateMeRequest = z.infer<typeof UpdateMeRequestSchema>;
```

- [ ] **Step 3: Add `currency` to the Mongoose User model**

Edit `apps/api/src/models/User.ts` so the schema includes `currency` with a default of `'INR'`:

```typescript
import { Schema, model, type InferSchemaType } from 'mongoose';

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    avatarUrl: { type: String },
    googleId: { type: String, index: true, sparse: true },
    isDemoUser: { type: Boolean, default: false },
    timezone: { type: String },
    // ISO 4217. Default INR keeps existing flows working; users change it
    // via PATCH /api/auth/me.
    currency: { type: String, default: 'INR' },
  },
  { timestamps: true }
);

export type UserDoc = InferSchemaType<typeof userSchema> & {
  _id: string;
  createdAt: Date;
  updatedAt: Date;
};

export const UserModel = model('User', userSchema);
```

- [ ] **Step 4: Hydrate `request.user.currency` in the auth plugin**

Edit `apps/api/src/plugins/auth.ts`. In the `app.authenticate` decorator, the block that builds `request.user`, add a `currency` line. Replace the existing assignment with:

```typescript
    request.user = {
      _id: String(user._id),
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl ?? undefined,
      googleId: user.googleId ?? undefined,
      isDemoUser: user.isDemoUser ?? false,
      timezone: user.timezone ?? undefined,
      currency: user.currency ?? 'INR',
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
```

- [ ] **Step 5: Include `currency` in the PATCH /api/auth/me response and handle currency updates**

Edit `apps/api/src/routes/auth.ts`. Inside the `app.patch('/api/auth/me', ...)` handler, after the `timezone` block, add a `currency` block and update the response. Final handler body (the `app.patch` block only; do not change anything else in this file):

```typescript
  app.patch(
    '/api/auth/me',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const parsed = UpdateMeRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: 'Invalid body',
          details: parsed.error.issues.map((i) => ({
            path: i.path.join('.'),
            message: i.message,
          })),
        });
      }

      const { timezone, currency } = parsed.data;
      if (typeof timezone === 'string' && !isValidTimezone(timezone)) {
        return reply.code(400).send({ error: 'Invalid timezone' });
      }

      const $set: Record<string, unknown> = {};
      const $unset: Record<string, unknown> = {};

      if (timezone === null) $unset.timezone = '';
      else if (typeof timezone === 'string') $set.timezone = timezone;

      if (typeof currency === 'string') $set.currency = currency;

      const update: Record<string, unknown> = {};
      if (Object.keys($set).length > 0) update.$set = $set;
      if (Object.keys($unset).length > 0) update.$unset = $unset;

      const doc =
        Object.keys(update).length === 0
          ? await UserModel.findById(request.user!._id).lean()
          : await UserModel.findByIdAndUpdate(request.user!._id, update, {
              new: true,
            }).lean();

      if (!doc) return reply.code(404).send({ error: 'Not found' });

      return {
        _id: String(doc._id),
        email: doc.email,
        name: doc.name,
        avatarUrl: doc.avatarUrl ?? undefined,
        googleId: doc.googleId ?? undefined,
        isDemoUser: doc.isDemoUser ?? false,
        timezone: doc.timezone ?? undefined,
        currency: doc.currency ?? 'INR',
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
      };
    }
  );
```

- [ ] **Step 6: Also include `currency` in the GET /api/auth/me response**

In the same file, the `GET /api/auth/me` handler already returns `request.user`, which now includes `currency` via the auth plugin hydration. No further change needed for GET. Confirm by re-reading the handler.

- [ ] **Step 7: Add currency assertions to the user-schema test**

Edit `apps/api/test/user-schema.test.ts` and append these `describe` blocks at the end of the file (after the existing `UpdateMeRequestSchema` describe block, **inside** the same module — i.e., file ends with these new blocks):

```typescript
describe('UserSchema (currency field)', () => {
  const base = {
    _id: '507f1f77bcf86cd799439011',
    email: 'a@b.test',
    name: 'A',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it('accepts a user without currency (legacy doc)', () => {
    expect(UserSchema.safeParse(base).success).toBe(true);
  });

  it('accepts a user with a valid ISO 4217 currency', () => {
    expect(UserSchema.safeParse({ ...base, currency: 'INR' }).success).toBe(true);
    expect(UserSchema.safeParse({ ...base, currency: 'USD' }).success).toBe(true);
  });

  it('rejects lowercase currency', () => {
    expect(UserSchema.safeParse({ ...base, currency: 'inr' }).success).toBe(false);
  });

  it('rejects non-3-letter currency', () => {
    expect(UserSchema.safeParse({ ...base, currency: 'INRA' }).success).toBe(false);
  });
});

describe('UpdateMeRequestSchema (currency field)', () => {
  it('accepts a currency-only patch', () => {
    expect(UpdateMeRequestSchema.safeParse({ currency: 'USD' }).success).toBe(true);
  });

  it('accepts a combined timezone+currency patch', () => {
    expect(
      UpdateMeRequestSchema.safeParse({ timezone: 'Asia/Kolkata', currency: 'INR' })
        .success
    ).toBe(true);
  });

  it('rejects a null currency (currency is not clearable)', () => {
    expect(UpdateMeRequestSchema.safeParse({ currency: null }).success).toBe(false);
  });

  it('rejects a malformed currency', () => {
    expect(UpdateMeRequestSchema.safeParse({ currency: 'inr' }).success).toBe(false);
  });
});
```

- [ ] **Step 8: Type-check and run tests**

Run: `npm -w @pathforge/shared run build && npm -w api run typecheck && npm -w api test -- --run user-schema auth-patch-me`
Expected: build succeeds, typecheck succeeds, all listed tests pass.

- [ ] **Step 9: Commit**

Run:
```bash
git add packages/shared/src/user.ts apps/api/src/models/User.ts apps/api/src/plugins/auth.ts apps/api/src/routes/auth.ts apps/api/test/user-schema.test.ts
git commit -m "$(cat <<'EOF'
feat(api): add user.currency field with default INR

Extends the User shape with an ISO 4217 currency code (default INR),
hydrated onto request.user, returned by GET/PATCH /api/auth/me, and
settable via the existing PATCH /api/auth/me handler. No null clearing —
every user has a currency.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3 — Mongoose models (five new collections)

**Files:**
- Create: `apps/api/src/models/BudgetCategoryGroup.ts`
- Create: `apps/api/src/models/BudgetCategory.ts`
- Create: `apps/api/src/models/BudgetTarget.ts`
- Create: `apps/api/src/models/BudgetTransaction.ts`
- Create: `apps/api/src/models/BudgetRecurringTemplate.ts`

- [ ] **Step 1: [Read first] Reference the JournalDay model for index + Doc type style**

Read `apps/api/src/models/JournalDay.ts` (compound indexes, `InferSchemaType + explicit timestamps`, `Types.ObjectId` refs).

- [ ] **Step 2: Create `BudgetCategoryGroup.ts`**

```typescript
import { Schema, model, type InferSchemaType, Types } from 'mongoose';

const budgetCategoryGroupSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    color: { type: String, required: true },
    order: { type: Number, required: true, default: 0 },
    archived: { type: Boolean, default: false },
  },
  { timestamps: true }
);

budgetCategoryGroupSchema.index({ userId: 1, archived: 1, order: 1 });
budgetCategoryGroupSchema.index({ userId: 1, name: 1 }, { unique: true });

export type BudgetCategoryGroupDoc = InferSchemaType<
  typeof budgetCategoryGroupSchema
> & {
  _id: string;
  createdAt: Date;
  updatedAt: Date;
};

export const BudgetCategoryGroupModel = model(
  'BudgetCategoryGroup',
  budgetCategoryGroupSchema
);
```

- [ ] **Step 3: Create `BudgetCategory.ts`**

```typescript
import { Schema, model, type InferSchemaType, Types } from 'mongoose';

const budgetCategorySchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: 'User', required: true },
    groupId: {
      type: Types.ObjectId,
      ref: 'BudgetCategoryGroup',
      required: true,
    },
    name: { type: String, required: true },
    kind: {
      type: String,
      enum: ['income', 'expense'],
      required: true,
    },
    color: { type: String },
    order: { type: Number, required: true, default: 0 },
    archived: { type: Boolean, default: false },
  },
  { timestamps: true }
);

budgetCategorySchema.index({ userId: 1, groupId: 1, archived: 1, order: 1 });
budgetCategorySchema.index({ userId: 1, name: 1 }, { unique: true });
budgetCategorySchema.index({ userId: 1, archived: 1, kind: 1 });

export type BudgetCategoryDoc = InferSchemaType<
  typeof budgetCategorySchema
> & {
  _id: string;
  createdAt: Date;
  updatedAt: Date;
};

export const BudgetCategoryModel = model(
  'BudgetCategory',
  budgetCategorySchema
);
```

- [ ] **Step 4: Create `BudgetTarget.ts`**

```typescript
import { Schema, model, type InferSchemaType, Types } from 'mongoose';

const budgetTargetSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: 'User', required: true },
    categoryId: {
      type: Types.ObjectId,
      ref: 'BudgetCategory',
      required: true,
    },
    month: {
      type: String,
      required: true,
      match: /^\d{4}-(0[1-9]|1[0-2])$/,
    },
    amount: { type: Number, required: true, min: 0 },
  },
  { timestamps: true }
);

// One target per category per month.
budgetTargetSchema.index(
  { userId: 1, month: 1, categoryId: 1 },
  { unique: true }
);
// Per-category target trend across months.
budgetTargetSchema.index({ userId: 1, categoryId: 1, month: -1 });

export type BudgetTargetDoc = InferSchemaType<typeof budgetTargetSchema> & {
  _id: string;
  createdAt: Date;
  updatedAt: Date;
};

export const BudgetTargetModel = model('BudgetTarget', budgetTargetSchema);
```

- [ ] **Step 5: Create `BudgetTransaction.ts`**

```typescript
import { Schema, model, type InferSchemaType, Types } from 'mongoose';

const budgetTransactionSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: 'User', required: true },
    date: { type: Date, required: true },
    categoryId: {
      type: Types.ObjectId,
      ref: 'BudgetCategory',
      required: true,
    },
    amount: { type: Number, required: true, min: 0 },
    description: { type: String },
    recurringTemplateId: {
      type: Types.ObjectId,
      ref: 'BudgetRecurringTemplate',
    },
  },
  { timestamps: true }
);

budgetTransactionSchema.index({ userId: 1, date: -1 });
budgetTransactionSchema.index({ userId: 1, categoryId: 1, date: -1 });

export type BudgetTransactionDoc = InferSchemaType<
  typeof budgetTransactionSchema
> & {
  _id: string;
  createdAt: Date;
  updatedAt: Date;
};

export const BudgetTransactionModel = model(
  'BudgetTransaction',
  budgetTransactionSchema
);
```

- [ ] **Step 6: Create `BudgetRecurringTemplate.ts`**

```typescript
import { Schema, model, type InferSchemaType, Types } from 'mongoose';

const budgetRecurringTemplateSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: 'User', required: true },
    label: { type: String, required: true },
    categoryId: {
      type: Types.ObjectId,
      ref: 'BudgetCategory',
      required: true,
    },
    amount: { type: Number, required: true, min: 0 },
    cadence: {
      type: String,
      enum: ['monthly'],
      required: true,
      default: 'monthly',
    },
    dayOfMonth: {
      type: Number,
      required: true,
      min: 1,
      max: 28,
    },
    lastRunMonth: {
      type: String,
      match: /^\d{4}-(0[1-9]|1[0-2])$/,
    },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

budgetRecurringTemplateSchema.index({ userId: 1, active: 1 });

export type BudgetRecurringTemplateDoc = InferSchemaType<
  typeof budgetRecurringTemplateSchema
> & {
  _id: string;
  createdAt: Date;
  updatedAt: Date;
};

export const BudgetRecurringTemplateModel = model(
  'BudgetRecurringTemplate',
  budgetRecurringTemplateSchema
);
```

- [ ] **Step 7: Type-check**

Run: `npm -w api run typecheck`
Expected: succeeds.

- [ ] **Step 8: Commit**

Run:
```bash
git add apps/api/src/models/BudgetCategoryGroup.ts apps/api/src/models/BudgetCategory.ts apps/api/src/models/BudgetTarget.ts apps/api/src/models/BudgetTransaction.ts apps/api/src/models/BudgetRecurringTemplate.ts
git commit -m "$(cat <<'EOF'
feat(api): add Mongoose models for budget collections

Five new models: BudgetCategoryGroup, BudgetCategory, BudgetTarget,
BudgetTransaction, BudgetRecurringTemplate. Compound indexes scope
every query by userId and support the access patterns the spec
identifies (group list, target trend, transaction log, etc).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4 — Budget helpers (serializers, month derivation, narrative)

**Files:**
- Create: `apps/api/src/lib/budget-helpers.ts`
- Create: `apps/api/test/budget-helpers.test.ts`

- [ ] **Step 1: [Read first] Reference helper patterns**

Read `apps/api/src/lib/journal-helpers.ts` (serializer style — string ObjectIds; optional → undefined; preserve Dates) and `apps/api/src/lib/reorder.ts` (`validateReorderIds` — will be reused by Budget reorder endpoints).

- [ ] **Step 2: Create `budget-helpers.ts`**

Create with exact content:

```typescript
import type {
  BudgetCategoryGroup,
  BudgetCategory,
  BudgetTarget,
  BudgetTransaction,
  BudgetRecurringTemplate,
  BudgetReport,
  BudgetReportGroupRow,
  CurrencyCode,
} from '@pathforge/shared';
import type { BudgetCategoryGroupDoc } from '../models/BudgetCategoryGroup.js';
import type { BudgetCategoryDoc } from '../models/BudgetCategory.js';
import type { BudgetTargetDoc } from '../models/BudgetTarget.js';
import type { BudgetTransactionDoc } from '../models/BudgetTransaction.js';
import type { BudgetRecurringTemplateDoc } from '../models/BudgetRecurringTemplate.js';

// ---- Month derivation ----

/**
 * Returns a `YYYY-MM` string for the given Date in UTC. Months in this app
 * are user-anchored only at display time; storage uses UTC-derived months
 * to keep aggregation deterministic. The frontend converts at the edge if
 * a future iteration needs user-local month bucketing.
 */
export function toIsoMonth(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/**
 * Returns the first millisecond of the given UTC month and the first
 * millisecond of the next UTC month, suitable for `$gte`/`$lt` queries
 * on `budgetTransactions.date`.
 */
export function monthRangeUtc(month: string): { start: Date; endExclusive: Date } {
  const [y, m] = month.split('-').map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
  const endExclusive = new Date(Date.UTC(y, m, 1, 0, 0, 0, 0));
  return { start, endExclusive };
}

// ---- Serializers ----

export function serializeBudgetGroup(
  doc: BudgetCategoryGroupDoc
): BudgetCategoryGroup {
  return {
    _id: String(doc._id),
    userId: String(doc.userId),
    name: doc.name,
    color: doc.color,
    order: doc.order ?? 0,
    archived: doc.archived ?? false,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export function serializeBudgetCategory(
  doc: BudgetCategoryDoc
): BudgetCategory {
  return {
    _id: String(doc._id),
    userId: String(doc.userId),
    groupId: String(doc.groupId),
    name: doc.name,
    kind: doc.kind as BudgetCategory['kind'],
    color: doc.color ?? undefined,
    order: doc.order ?? 0,
    archived: doc.archived ?? false,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export function serializeBudgetTarget(doc: BudgetTargetDoc): BudgetTarget {
  return {
    _id: String(doc._id),
    userId: String(doc.userId),
    categoryId: String(doc.categoryId),
    month: doc.month,
    amount: doc.amount,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export function serializeBudgetTransaction(
  doc: BudgetTransactionDoc
): BudgetTransaction {
  return {
    _id: String(doc._id),
    userId: String(doc.userId),
    date: doc.date,
    categoryId: String(doc.categoryId),
    amount: doc.amount,
    description: doc.description ?? undefined,
    recurringTemplateId: doc.recurringTemplateId
      ? String(doc.recurringTemplateId)
      : undefined,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export function serializeBudgetRecurring(
  doc: BudgetRecurringTemplateDoc
): BudgetRecurringTemplate {
  return {
    _id: String(doc._id),
    userId: String(doc.userId),
    label: doc.label,
    categoryId: String(doc.categoryId),
    amount: doc.amount,
    cadence: 'monthly',
    dayOfMonth: doc.dayOfMonth,
    lastRunMonth: doc.lastRunMonth ?? undefined,
    active: doc.active ?? true,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

// ---- Default seed payloads ----

/**
 * Pure data — the routes layer calls this and persists the docs. Keeping
 * the seed shape next to the serializers lets the unit tests assert on it
 * without booting the DB.
 */
export function defaultGroupsSeed(): Array<{
  name: string;
  color: string;
  order: number;
}> {
  return [
    { name: 'Income', color: '#10b981', order: 0 },   // emerald-500
    { name: 'Bills', color: '#ef4444', order: 1 },    // red-500
    { name: 'Household', color: '#f59e0b', order: 2 }, // amber-500
    { name: 'Debt', color: '#dc2626', order: 3 },     // red-600
    { name: 'Leisure', color: '#8b5cf6', order: 4 },  // violet-500
    { name: 'Savings', color: '#0ea5e9', order: 5 },  // sky-500
    { name: 'Other', color: '#64748b', order: 6 },    // slate-500
  ];
}

/**
 * Per-group seed categories. Names referenced by group `name` since the
 * caller knows the freshly-inserted group ids only after persisting.
 */
export function defaultCategoriesSeed(): Array<{
  groupName: string;
  name: string;
  kind: 'income' | 'expense';
  order: number;
}> {
  return [
    { groupName: 'Income', name: 'Salary', kind: 'income', order: 0 },
    { groupName: 'Bills', name: 'Rent', kind: 'expense', order: 0 },
    { groupName: 'Bills', name: 'Electricity', kind: 'expense', order: 1 },
    { groupName: 'Household', name: 'Groceries', kind: 'expense', order: 0 },
    { groupName: 'Household', name: 'Transport', kind: 'expense', order: 1 },
    { groupName: 'Leisure', name: 'Dining', kind: 'expense', order: 0 },
  ];
}

// ---- Narrative generator ----

/**
 * Generates a one-line narrative summarising the month. Deterministic and
 * template-driven (no LLM in v1). The caller passes in the assembled
 * report rows; this function does not query the DB.
 *
 * Decision: pick the single highest-overshoot expense category and the
 * single biggest-underspend expense category. If no targets exist for the
 * month, surface that explicitly. If no transactions, surface that.
 */
export function generateNarrative(args: {
  month: string;             // "YYYY-MM"
  currency: CurrencyCode;
  expenseActual: number;
  expenseTarget: number;
  hasAnyTarget: boolean;
  hasAnyTransaction: boolean;
  expenseGroups: BudgetReportGroupRow[];
}): string {
  const monthLabel = formatMonth(args.month);
  const cur = args.currency;

  if (!args.hasAnyTransaction) {
    return `In ${monthLabel}, no transactions were logged.`;
  }

  if (!args.hasAnyTarget) {
    return `In ${monthLabel}, you spent ${formatMoney(
      args.expenseActual,
      cur
    )} — no plan was set for this month.`;
  }

  const diff = args.expenseActual - args.expenseTarget;
  const direction = diff <= 0 ? 'under' : 'over';
  const pct =
    args.expenseTarget > 0
      ? Math.round((Math.abs(diff) / args.expenseTarget) * 100)
      : 0;

  const expenseRows = args.expenseGroups
    .flatMap((g) => g.categories.map((c) => ({ ...c, groupName: g.name })))
    .filter((r) => r.target > 0 || r.actual > 0);

  const overshoot = expenseRows
    .filter((r) => r.actual > r.target)
    .sort((a, b) => b.actual - b.target - (a.actual - a.target))[0];

  const underspend = expenseRows
    .filter((r) => r.target > r.actual && r.target > 0)
    .sort((a, b) => b.target - b.actual - (a.target - a.actual))[0];

  const parts: string[] = [];
  parts.push(
    `In ${monthLabel}, you spent ${formatMoney(
      args.expenseActual,
      cur
    )} against a planned ${formatMoney(args.expenseTarget, cur)} — ${direction} by ${formatMoney(
      Math.abs(diff),
      cur
    )} (${pct}%).`
  );
  if (overshoot) {
    parts.push(
      `Biggest overage: ${overshoot.name} (${formatMoney(
        overshoot.actual,
        cur
      )} vs ${formatMoney(overshoot.target, cur)}).`
    );
  }
  if (underspend) {
    parts.push(
      `Biggest underspend: ${underspend.name} (${formatMoney(
        underspend.actual,
        cur
      )} vs ${formatMoney(underspend.target, cur)}).`
    );
  }
  return parts.join(' ');
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function formatMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

/**
 * Formats integer minor units back to a display string for the narrative.
 * Uses the currency symbol where well-known; falls back to the ISO code.
 * The web UI does its own formatting — this is only for narrative strings.
 */
function formatMoney(minor: number, currency: CurrencyCode): string {
  const major = Math.round(minor / 100);
  const formatted = major.toLocaleString('en-IN');
  const symbol = CURRENCY_SYMBOL[currency] ?? `${currency} `;
  return `${symbol}${formatted}`;
}

const CURRENCY_SYMBOL: Record<string, string> = {
  INR: '₹',
  USD: '$',
  EUR: '€',
  GBP: '£',
  AUD: 'A$',
  CAD: 'C$',
  SGD: 'S$',
  JPY: '¥',
};

// ---- Used by report endpoint: roll up transactions + targets into rows ----

export function buildReportRows(args: {
  groups: BudgetCategoryGroupDoc[];
  categories: BudgetCategoryDoc[];
  transactions: BudgetTransactionDoc[];
  targets: BudgetTargetDoc[];
}): BudgetReportGroupRow[] {
  const categoriesByGroup = new Map<string, BudgetCategoryDoc[]>();
  for (const c of args.categories) {
    const key = String(c.groupId);
    if (!categoriesByGroup.has(key)) categoriesByGroup.set(key, []);
    categoriesByGroup.get(key)!.push(c);
  }

  const actualByCategory = new Map<string, number>();
  for (const t of args.transactions) {
    const key = String(t.categoryId);
    actualByCategory.set(key, (actualByCategory.get(key) ?? 0) + t.amount);
  }

  const targetByCategory = new Map<string, number>();
  for (const t of args.targets) {
    targetByCategory.set(String(t.categoryId), t.amount);
  }

  const rows: BudgetReportGroupRow[] = [];
  for (const g of args.groups) {
    const cats = (categoriesByGroup.get(String(g._id)) ?? [])
      .slice()
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    // A group is income if all its non-archived categories are income.
    // Mixed groups are flagged as 'expense' by convention — rare but
    // harmless. (Spec uses groups as organizational, not type-bearing.)
    const liveKinds = new Set(
      cats.filter((c) => !c.archived).map((c) => c.kind)
    );
    const groupKind: 'income' | 'expense' =
      liveKinds.size === 1 && liveKinds.has('income') ? 'income' : 'expense';

    const categoryRows = cats.map((c) => {
      const actual = actualByCategory.get(String(c._id)) ?? 0;
      const target = targetByCategory.get(String(c._id)) ?? 0;
      return {
        categoryId: String(c._id),
        name: c.name,
        actual,
        target,
        delta: actual - target,
      };
    });

    const groupActual = categoryRows.reduce((s, r) => s + r.actual, 0);
    const groupTarget = categoryRows.reduce((s, r) => s + r.target, 0);

    rows.push({
      groupId: String(g._id),
      name: g.name,
      kind: groupKind,
      actual: groupActual,
      target: groupTarget,
      delta: groupActual - groupTarget,
      categories: categoryRows,
    });
  }
  return rows;
}

export function totalsFromRows(rows: BudgetReportGroupRow[]): {
  income: number;
  expense: number;
  net: number;
} {
  let income = 0;
  let expense = 0;
  for (const r of rows) {
    if (r.kind === 'income') income += r.actual;
    else expense += r.actual;
  }
  return { income, expense, net: income - expense };
}

export function targetTotalsFromRows(rows: BudgetReportGroupRow[]): {
  income: number;
  expense: number;
  net: number;
} {
  let income = 0;
  let expense = 0;
  for (const r of rows) {
    if (r.kind === 'income') income += r.target;
    else expense += r.target;
  }
  return { income, expense, net: income - expense };
}
```

- [ ] **Step 3: Create `apps/api/test/budget-helpers.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import {
  toIsoMonth,
  monthRangeUtc,
  generateNarrative,
  defaultGroupsSeed,
  defaultCategoriesSeed,
  buildReportRows,
  totalsFromRows,
  targetTotalsFromRows,
} from '../src/lib/budget-helpers.js';

describe('toIsoMonth', () => {
  it('formats UTC month with zero-padding', () => {
    expect(toIsoMonth(new Date(Date.UTC(2026, 4, 22)))).toBe('2026-05');
    expect(toIsoMonth(new Date(Date.UTC(2026, 0, 1)))).toBe('2026-01');
    expect(toIsoMonth(new Date(Date.UTC(2026, 11, 31)))).toBe('2026-12');
  });
});

describe('monthRangeUtc', () => {
  it('returns first-of-month and first-of-next-month', () => {
    const r = monthRangeUtc('2026-05');
    expect(r.start.toISOString()).toBe('2026-05-01T00:00:00.000Z');
    expect(r.endExclusive.toISOString()).toBe('2026-06-01T00:00:00.000Z');
  });

  it('wraps December to next year January', () => {
    const r = monthRangeUtc('2026-12');
    expect(r.endExclusive.toISOString()).toBe('2027-01-01T00:00:00.000Z');
  });
});

describe('defaultGroupsSeed', () => {
  it('returns 7 unique named groups in order 0-6', () => {
    const groups = defaultGroupsSeed();
    expect(groups).toHaveLength(7);
    expect(new Set(groups.map((g) => g.name)).size).toBe(7);
    expect(groups.map((g) => g.order)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });
});

describe('defaultCategoriesSeed', () => {
  it('references only groups that defaultGroupsSeed declares', () => {
    const groupNames = new Set(defaultGroupsSeed().map((g) => g.name));
    for (const c of defaultCategoriesSeed()) {
      expect(groupNames.has(c.groupName)).toBe(true);
    }
  });

  it('marks the single income category correctly', () => {
    const cats = defaultCategoriesSeed();
    const incomes = cats.filter((c) => c.kind === 'income');
    expect(incomes).toHaveLength(1);
    expect(incomes[0]?.name).toBe('Salary');
  });
});

describe('buildReportRows + totals', () => {
  const groupId = 'g0';
  const incomeGroupId = 'gi';

  // Cast to the model Doc shape just for the helper's structural read.
  const groups = [
    {
      _id: groupId,
      name: 'Bills',
      color: '#ef4444',
      order: 1,
      archived: false,
      userId: 'u',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      _id: incomeGroupId,
      name: 'Income',
      color: '#10b981',
      order: 0,
      archived: false,
      userId: 'u',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ] as never;

  const categories = [
    {
      _id: 'cRent',
      groupId,
      userId: 'u',
      name: 'Rent',
      kind: 'expense',
      order: 0,
      archived: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      _id: 'cSalary',
      groupId: incomeGroupId,
      userId: 'u',
      name: 'Salary',
      kind: 'income',
      order: 0,
      archived: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ] as never;

  const transactions = [
    {
      _id: 't1',
      userId: 'u',
      categoryId: 'cRent',
      amount: 18_00_000, // 18,000.00 INR in paise
      date: new Date('2026-05-01'),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      _id: 't2',
      userId: 'u',
      categoryId: 'cSalary',
      amount: 50_00_000,
      date: new Date('2026-05-01'),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ] as never;

  const targets = [
    {
      _id: 'tg1',
      userId: 'u',
      categoryId: 'cRent',
      month: '2026-05',
      amount: 18_00_000,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ] as never;

  it('rolls up actuals and targets per group + per category', () => {
    const rows = buildReportRows({ groups, categories, transactions, targets });
    const bills = rows.find((r) => r.groupId === groupId)!;
    expect(bills.actual).toBe(18_00_000);
    expect(bills.target).toBe(18_00_000);
    expect(bills.delta).toBe(0);
    expect(bills.kind).toBe('expense');
    expect(bills.categories[0]?.name).toBe('Rent');
  });

  it('marks groups containing only income categories as kind=income', () => {
    const rows = buildReportRows({ groups, categories, transactions, targets });
    const income = rows.find((r) => r.groupId === incomeGroupId)!;
    expect(income.kind).toBe('income');
  });

  it('totalsFromRows separates income and expense', () => {
    const rows = buildReportRows({ groups, categories, transactions, targets });
    const totals = totalsFromRows(rows);
    expect(totals.income).toBe(50_00_000);
    expect(totals.expense).toBe(18_00_000);
    expect(totals.net).toBe(32_00_000);
  });

  it('targetTotalsFromRows considers only target amounts', () => {
    const rows = buildReportRows({ groups, categories, transactions, targets });
    const t = targetTotalsFromRows(rows);
    expect(t.income).toBe(0);     // no income target set
    expect(t.expense).toBe(18_00_000);
    expect(t.net).toBe(-18_00_000);
  });
});

describe('generateNarrative', () => {
  it('reports no transactions case', () => {
    const n = generateNarrative({
      month: '2026-05',
      currency: 'INR',
      expenseActual: 0,
      expenseTarget: 0,
      hasAnyTarget: false,
      hasAnyTransaction: false,
      expenseGroups: [],
    });
    expect(n).toContain('no transactions');
    expect(n).toContain('May 2026');
  });

  it('reports no plan case', () => {
    const n = generateNarrative({
      month: '2026-05',
      currency: 'INR',
      expenseActual: 36_80_000,
      expenseTarget: 0,
      hasAnyTarget: false,
      hasAnyTransaction: true,
      expenseGroups: [],
    });
    expect(n).toContain('no plan was set');
    expect(n).toContain('₹36,800');
  });

  it('summarises under-target with biggest overage and underspend', () => {
    const n = generateNarrative({
      month: '2026-05',
      currency: 'INR',
      expenseActual: 36_80_000,
      expenseTarget: 40_00_000,
      hasAnyTarget: true,
      hasAnyTransaction: true,
      expenseGroups: [
        {
          groupId: 'g',
          name: 'Leisure',
          kind: 'expense',
          actual: 6_40_000,
          target: 6_00_000,
          delta: 40_000,
          categories: [
            { categoryId: 'd', name: 'Dining', actual: 3_20_000, target: 2_00_000, delta: 1_20_000 },
            { categoryId: 'g', name: 'Groceries', actual: 6_40_000, target: 8_00_000, delta: -1_60_000 },
          ],
        },
      ],
    });
    expect(n).toContain('under by ₹3,200');
    expect(n).toContain('Biggest overage: Dining');
    expect(n).toContain('Biggest underspend: Groceries');
  });

  it('summarises over-target', () => {
    const n = generateNarrative({
      month: '2026-05',
      currency: 'USD',
      expenseActual: 45_000,    // $450.00
      expenseTarget: 40_000,    // $400.00
      hasAnyTarget: true,
      hasAnyTransaction: true,
      expenseGroups: [],
    });
    expect(n).toContain('over by $50');
  });
});
```

- [ ] **Step 4: Run helper tests**

Run: `npm -w api test -- --run budget-helpers`
Expected: all tests pass.

- [ ] **Step 5: Commit**

Run:
```bash
git add apps/api/src/lib/budget-helpers.ts apps/api/test/budget-helpers.test.ts
git commit -m "$(cat <<'EOF'
feat(api): add budget helpers (serializers, month derivation, narrative)

Serializers for the five Budget models, UTC month derivation utilities,
default seed payloads for groups + categories, the report row-roll-up
function, and a deterministic template-driven narrative generator
(no LLM). Unit tests cover the trickier paths.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5 — Groups routes (+ seeding on first GET)

**Files:**
- Create: `apps/api/src/routes/budget.ts` (initial — groups only; later tasks append)

- [ ] **Step 1: [Read first] Reference route patterns**

Read `apps/api/src/routes/journal.ts` (validation helpers, `sendValidationError`, `findOneAndUpdate` patterns) and `apps/api/src/routes/jobs.ts` if larger; also re-read `apps/api/src/lib/reorder.ts`.

- [ ] **Step 2: Create `budget.ts` with groups routes + seeding**

Create `apps/api/src/routes/budget.ts` with this content. (Subsequent tasks append more route registrations to the same file.)

```typescript
import type { FastifyInstance, FastifyReply } from 'fastify';
import { Types } from 'mongoose';
import { z } from 'zod';
import {
  CreateBudgetGroupRequestSchema,
  UpdateBudgetGroupRequestSchema,
  ReorderRequestSchema,
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
 * if any group already exists, this is a no-op. Returns the freshly-seeded
 * (or existing) groups, sorted by order.
 *
 * Not wrapped in a session/transaction — Mongo single-node dev mode doesn't
 * support multi-document transactions, and the seed is one-shot. The race
 * window where two parallel GETs both seed is bounded by the
 * `{userId,name}` unique index, which will reject the second insert.
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

      // place at end
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

  // PATCH /api/budget/groups/reorder — bulk reorder by full id list
  app.patch(
    '/api/budget/groups/reorder',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const parsed = ReorderRequestSchema.safeParse(request.body);
      if (!parsed.success) return sendValidationError(reply, parsed.error);
      const userId = request.user!._id;

      const existing = await BudgetCategoryGroupModel.find({ userId })
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

      const docs = await BudgetCategoryGroupModel.find({ userId })
        .sort({ order: 1, createdAt: 1 })
        .lean();
      return docs.map((d) => serializeBudgetGroup(d as never));
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
```

- [ ] **Step 3: Register the route in `server.ts`**

Edit `apps/api/src/server.ts`. Add the import and registration alongside the others. The relevant block becomes:

```typescript
import { healthRoutes } from './routes/health.js';
import authPlugin from './plugins/auth.js';
import { authRoutes } from './routes/auth.js';
import { roadmapsRoutes } from './routes/roadmaps.js';
import { jobsRoutes } from './routes/jobs.js';
import { journalRoutes } from './routes/journal.js';
import { budgetRoutes } from './routes/budget.js';
```

And in `buildApp`:

```typescript
  await app.register(roadmapsRoutes);
  await app.register(jobsRoutes);
  await app.register(journalRoutes);
  await app.register(budgetRoutes);
```

- [ ] **Step 4: Create the smoke test stub**

Create `apps/api/test/budget.test.ts` with this initial content (later tasks append per-endpoint cases):

```typescript
import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/server.js';

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp({ skipDb: true });
});

afterAll(async () => {
  await app.close();
});

describe('Budget routes (smoke — no session)', () => {
  it('GET /api/budget/groups returns 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/budget/groups' });
    expect(res.statusCode).toBe(401);
  });

  it('POST /api/budget/groups returns 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/budget/groups',
      payload: { name: 'Income', color: '#10b981' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('PATCH /api/budget/groups/reorder returns 401', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/budget/groups/reorder',
      payload: { ids: ['507f1f77bcf86cd799439011'] },
    });
    expect(res.statusCode).toBe(401);
  });
});
```

- [ ] **Step 5: Run tests and typecheck**

Run: `npm -w api run typecheck && npm -w api test -- --run budget`
Expected: typecheck passes; smoke tests pass.

- [ ] **Step 6: Commit**

Run:
```bash
git add apps/api/src/routes/budget.ts apps/api/src/server.ts apps/api/test/budget.test.ts
git commit -m "$(cat <<'EOF'
feat(api): add /api/budget/groups CRUD and seed-on-first-read

CRUD + bulk reorder for budget category groups. The GET handler seeds
default groups + categories transactionally on the first read for a user
with none. Soft-delete via archived flag; 409 if a group still has live
categories. Routes registered in buildApp; smoke tests confirm 401
without a session.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6 — Categories routes

**Files:**
- Modify: `apps/api/src/routes/budget.ts` (append handlers)
- Modify: `apps/api/test/budget.test.ts` (append 401 cases)

- [ ] **Step 1: Add imports + handlers in `budget.ts`**

At the top of `budget.ts`, extend the `@pathforge/shared` import line to include the category schemas:

```typescript
import {
  CreateBudgetGroupRequestSchema,
  UpdateBudgetGroupRequestSchema,
  CreateBudgetCategoryRequestSchema,
  UpdateBudgetCategoryRequestSchema,
  ReorderRequestSchema,
  CategoryKindSchema,
} from '@pathforge/shared';
```

Add `serializeBudgetCategory` to the helper import:

```typescript
import {
  defaultGroupsSeed,
  defaultCategoriesSeed,
  serializeBudgetGroup,
  serializeBudgetCategory,
} from '../lib/budget-helpers.js';
```

Inside `budgetRoutes`, after the groups handlers, add:

```typescript
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

  // PATCH /api/budget/categories/reorder — reorder within a group
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

      const existing = await BudgetCategoryModel.find({
        userId,
        groupId: parsed.data.groupId,
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
      })
        .sort({ order: 1, createdAt: 1 })
        .lean();
      return docs.map((d) => serializeBudgetCategory(d as never));
    }
  );
```

- [ ] **Step 2: Append smoke tests in `budget.test.ts`**

Inside the same `describe('Budget routes (smoke — no session)', ...)` block, append:

```typescript
  it('GET /api/budget/categories returns 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/budget/categories' });
    expect(res.statusCode).toBe(401);
  });

  it('POST /api/budget/categories returns 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/budget/categories',
      payload: {
        groupId: '507f1f77bcf86cd799439011',
        name: 'Rent',
        kind: 'expense',
      },
    });
    expect(res.statusCode).toBe(401);
  });

  it('PATCH /api/budget/categories/reorder returns 401', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/budget/categories/reorder',
      payload: {
        groupId: '507f1f77bcf86cd799439011',
        ids: ['507f1f77bcf86cd799439012'],
      },
    });
    expect(res.statusCode).toBe(401);
  });
```

- [ ] **Step 3: Run typecheck + tests**

Run: `npm -w api run typecheck && npm -w api test -- --run budget`
Expected: passes.

- [ ] **Step 4: Commit**

Run:
```bash
git add apps/api/src/routes/budget.ts apps/api/test/budget.test.ts
git commit -m "$(cat <<'EOF'
feat(api): add /api/budget/categories CRUD + reorder

Categories scoped by user and group, with kind (income/expense),
soft-delete via archived, and within-group reorder. Create/update
validate that the referenced groupId belongs to the user.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7 — Transactions routes

**Files:**
- Modify: `apps/api/src/routes/budget.ts`
- Modify: `apps/api/test/budget.test.ts`

- [ ] **Step 1: Extend imports**

In `budget.ts`, extend the shared import:

```typescript
import {
  CreateBudgetGroupRequestSchema,
  UpdateBudgetGroupRequestSchema,
  CreateBudgetCategoryRequestSchema,
  UpdateBudgetCategoryRequestSchema,
  CreateBudgetTransactionRequestSchema,
  UpdateBudgetTransactionRequestSchema,
  ReorderRequestSchema,
  CategoryKindSchema,
  MonthStringSchema,
  type CategoryKind,
} from '@pathforge/shared';
```

Add the transaction model + serializer + month helper imports:

```typescript
import { BudgetTransactionModel } from '../models/BudgetTransaction.js';
import {
  defaultGroupsSeed,
  defaultCategoriesSeed,
  serializeBudgetGroup,
  serializeBudgetCategory,
  serializeBudgetTransaction,
  monthRangeUtc,
} from '../lib/budget-helpers.js';
```

- [ ] **Step 2: Append transaction routes inside `budgetRoutes`**

```typescript
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

  // DELETE /api/budget/transactions/:id  → hard delete
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
```

- [ ] **Step 3: Add `defaultCurrentMonth` helper at the bottom of `budget.ts`**

After the `isDuplicateKey` helper, before the `void` lines:

```typescript
function defaultCurrentMonth(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}
```

- [ ] **Step 4: Append smoke tests**

Inside the existing describe block in `budget.test.ts`:

```typescript
  it('GET /api/budget/transactions returns 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/budget/transactions?month=2026-05',
    });
    expect(res.statusCode).toBe(401);
  });

  it('POST /api/budget/transactions returns 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/budget/transactions',
      payload: {
        date: '2026-05-22T10:00:00Z',
        categoryId: '507f1f77bcf86cd799439011',
        amount: 50_000,
      },
    });
    expect(res.statusCode).toBe(401);
  });

  it('DELETE /api/budget/transactions/:id returns 401', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/budget/transactions/507f1f77bcf86cd799439011',
    });
    expect(res.statusCode).toBe(401);
  });
```

- [ ] **Step 5: Run typecheck + tests**

Run: `npm -w api run typecheck && npm -w api test -- --run budget`
Expected: passes.

- [ ] **Step 6: Commit**

Run:
```bash
git add apps/api/src/routes/budget.ts apps/api/test/budget.test.ts
git commit -m "$(cat <<'EOF'
feat(api): add /api/budget/transactions CRUD

Manual transaction log scoped by user. Month filter via UTC range
query, category ownership validated at create/update, hard delete
on remove (transactions are not soft-deleted; only categories are).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8 — Targets routes (bulk upsert)

**Files:**
- Modify: `apps/api/src/routes/budget.ts`
- Modify: `apps/api/test/budget.test.ts`

- [ ] **Step 1: Extend imports**

In `budget.ts`, add to the shared import:

```typescript
  BulkUpsertTargetsRequestSchema,
```

And to the model + helper imports:

```typescript
import { BudgetTargetModel } from '../models/BudgetTarget.js';
import {
  // ...existing
  serializeBudgetTarget,
} from '../lib/budget-helpers.js';
```

- [ ] **Step 2: Append target routes**

```typescript
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

      // Upsert each. Sequential to avoid hammering Mongo with parallel
      // upserts on the same (userId, month) index slice.
      const operations = items.map((item) =>
        BudgetTargetModel.updateOne(
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
        )
      );
      for (const op of operations) await op;

      const docs = await BudgetTargetModel.find({ userId, month }).lean();
      return docs.map((d) => serializeBudgetTarget(d as never));
    }
  );

  // DELETE /api/budget/targets/:id
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
```

- [ ] **Step 3: Append smoke tests**

```typescript
  it('GET /api/budget/targets returns 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/budget/targets?month=2026-05',
    });
    expect(res.statusCode).toBe(401);
  });

  it('PUT /api/budget/targets returns 401', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/budget/targets',
      payload: { month: '2026-05', items: [] },
    });
    expect(res.statusCode).toBe(401);
  });
```

- [ ] **Step 4: Typecheck + tests**

Run: `npm -w api run typecheck && npm -w api test -- --run budget`
Expected: passes.

- [ ] **Step 5: Commit**

Run:
```bash
git add apps/api/src/routes/budget.ts apps/api/test/budget.test.ts
git commit -m "$(cat <<'EOF'
feat(api): add /api/budget/targets bulk upsert

GET lists targets for a month; PUT bulk-upserts {categoryId, amount}
items for a month, validating category ownership; DELETE removes a
single target. Per-month per-category uniqueness enforced by the
compound index on the model.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9 — Recurring templates routes (+ apply)

**Files:**
- Modify: `apps/api/src/routes/budget.ts`
- Modify: `apps/api/test/budget.test.ts`

- [ ] **Step 1: Extend imports**

```typescript
  CreateBudgetRecurringRequestSchema,
  UpdateBudgetRecurringRequestSchema,
```

```typescript
import { BudgetRecurringTemplateModel } from '../models/BudgetRecurringTemplate.js';
import {
  // ...existing
  serializeBudgetRecurring,
} from '../lib/budget-helpers.js';
```

- [ ] **Step 2: Append routes**

```typescript
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
  app.post(
    '/api/budget/recurring/:id/apply',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      if (!isObjectId(id)) return reply.code(400).send({ error: 'Invalid id' });
      const userId = request.user!._id;

      const tmpl = await BudgetRecurringTemplateModel.findOne({
        _id: id,
        userId,
      });
      if (!tmpl) return reply.code(404).send({ error: 'Not found' });
      if (!tmpl.active) {
        return reply.code(409).send({ error: 'template_inactive' });
      }

      const month = defaultCurrentMonth();
      if (tmpl.lastRunMonth === month) {
        return reply.code(409).send({
          error: 'already_applied',
          lastRunMonth: tmpl.lastRunMonth,
        });
      }

      // Date for the transaction: dayOfMonth of the current month at 09:00 UTC.
      // Hour chosen to be unambiguously "this day" across most user timezones.
      const [y, m] = month.split('-').map(Number);
      const date = new Date(Date.UTC(y, m - 1, tmpl.dayOfMonth, 9, 0, 0, 0));

      const txn = await BudgetTransactionModel.create({
        userId: new Types.ObjectId(userId),
        date,
        categoryId: tmpl.categoryId,
        amount: tmpl.amount,
        description: tmpl.label,
        recurringTemplateId: tmpl._id,
      });

      tmpl.lastRunMonth = month;
      await tmpl.save();

      return reply
        .code(201)
        .send(serializeBudgetTransaction(txn.toObject() as never));
    }
  );
```

- [ ] **Step 3: Append smoke tests**

```typescript
  it('GET /api/budget/recurring returns 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/budget/recurring' });
    expect(res.statusCode).toBe(401);
  });

  it('POST /api/budget/recurring/:id/apply returns 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/budget/recurring/507f1f77bcf86cd799439011/apply',
    });
    expect(res.statusCode).toBe(401);
  });
```

- [ ] **Step 4: Typecheck + tests**

Run: `npm -w api run typecheck && npm -w api test -- --run budget`
Expected: passes.

- [ ] **Step 5: Commit**

Run:
```bash
git add apps/api/src/routes/budget.ts apps/api/test/budget.test.ts
git commit -m "$(cat <<'EOF'
feat(api): add /api/budget/recurring CRUD + apply

Recurring monthly templates with opt-in apply: POST /:id/apply creates
a transaction for the current month and stamps lastRunMonth, 409-ing
on a second apply in the same month. Inactive templates 409 on apply.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10 — Report endpoint

**Files:**
- Modify: `apps/api/src/routes/budget.ts`
- Modify: `apps/api/test/budget.test.ts`

- [ ] **Step 1: Extend imports**

In `budget.ts`, the helper import becomes:

```typescript
import {
  defaultGroupsSeed,
  defaultCategoriesSeed,
  serializeBudgetGroup,
  serializeBudgetCategory,
  serializeBudgetTransaction,
  serializeBudgetTarget,
  serializeBudgetRecurring,
  monthRangeUtc,
  buildReportRows,
  totalsFromRows,
  targetTotalsFromRows,
  generateNarrative,
} from '../lib/budget-helpers.js';
```

Also import the User model for currency lookup:

```typescript
import { UserModel } from '../models/User.js';
```

- [ ] **Step 2: Append the report handler**

```typescript
  // GET /api/budget/report?month=YYYY-MM
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
```

- [ ] **Step 3: Append smoke test**

```typescript
  it('GET /api/budget/report returns 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/budget/report?month=2026-05',
    });
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/budget/report (no month) returns 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/budget/report',
    });
    expect(res.statusCode).toBe(401);
  });
```

- [ ] **Step 4: Typecheck + full test suite**

Run: `npm -w api run typecheck && npm -w api test -- --run`
Expected: all tests pass (budget + existing).

- [ ] **Step 5: Commit**

Run:
```bash
git add apps/api/src/routes/budget.ts apps/api/test/budget.test.ts
git commit -m "$(cat <<'EOF'
feat(api): add /api/budget/report monthly retrospective endpoint

Single round-trip pulling groups, categories, transactions, targets,
recurring templates, and user currency, then rolling them up via
buildReportRows + totals + targetTotals + generateNarrative. Returns
the BudgetReport shape consumed by the report page and dashboard
widget.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11 — Final wire-up verification

**Files:** (verification only — no changes expected)

- [ ] **Step 1: Confirm route registration**

Read `apps/api/src/server.ts` and verify `budgetRoutes` is imported and registered. If not, re-apply Task 5 Step 3.

- [ ] **Step 2: Run full test suite**

Run: `npm -w api test -- --run`
Expected: all tests pass — `budget-schema`, `budget-helpers`, `budget`, and every pre-existing suite.

- [ ] **Step 3: Run typecheck on every workspace**

Run: `npm -w @pathforge/shared run build && npm -w api run typecheck && npm -w web run typecheck`
Expected: all succeed. (The web typecheck should pass even though no UI exists yet — the shared package's new exports are not yet consumed.)

- [ ] **Step 4: Manual smoke (optional, requires docker)**

If a docker dev environment is convenient:
1. `docker compose up -d` (or whichever existing command brings up mongo + api locally).
2. Log in as a dev user via the web app, then:
   - `curl --cookie pf_session=...signed... http://localhost:4000/api/budget/groups` — expect a 200 with the seven seeded groups on first call.
   - `curl --cookie pf_session=...signed... http://localhost:4000/api/budget/report?month=$(date +%Y-%m)` — expect a 200 with empty totals and a "no transactions" narrative.

(If the cookie roundtrip is awkward, defer manual smoke until the frontend lands; the smoke tests already prove auth/registration.)

- [ ] **Step 5: No commit required**

This task is verification only.

---

## Self-Review Notes

Coverage:
- ✅ Five collections — Tasks 3, 1 (schemas).
- ✅ `currency` on User — Task 2.
- ✅ All ~22 endpoints (groups/categories/transactions/targets/recurring/report) — Tasks 5–10.
- ✅ Seeding on first GET — Task 5.
- ✅ Narrative generator (template, no LLM) — Task 4.
- ✅ Edge cases — duplicate-name (409), invalid_category (400), group_has_active_categories (409), already_applied (409), template_inactive (409), 401-without-session (smoke).
- ✅ Money as integer minor units; month as YYYY-MM — codified in schemas + helpers.
- ✅ Shared schema keystone preserved (all shapes in `packages/shared/src/budget.ts`).
- ✅ `userId` on every collection; every query filters by it; compound indexes start with `userId`.
- ✅ Auth shape unchanged (reuses existing `app.authenticate`); only `PATCH /api/auth/me` extended.

Not yet implemented (frontend plan):
- Any `apps/web/**` work — `useBudget*` hooks, `BudgetPage`, `BudgetPlanPage`, `BudgetReportPage`, `BudgetCategoriesPage`, `BudgetRecurringPage`, `BudgetSettingsPage`, `BudgetWidget`, navbar entry, currency selector UI.

This plan should produce working, testable software on its own — the API can be exercised end-to-end via `curl` (or the existing `app.inject` harness with hand-crafted cookies) before any UI exists.
