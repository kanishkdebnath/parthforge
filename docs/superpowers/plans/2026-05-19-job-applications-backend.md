# Job Applications — Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the backend half of the Job Applications feature: shared Zod schemas, Mongoose model, twelve REST endpoints under `/api/jobs`, helper unit tests, and a smoke integration test. The frontend will be planned and implemented in a separate follow-up plan, matching the way roadmaps shipped (backend → frontend).

**Architecture:** Same shape as the existing `roadmaps` feature. Single Mongo document per application with `rounds` and `contacts` as embedded subdocument arrays. Routes filter by `req.user._id` on every query. Subdocument endpoints follow the milestone/step precedent (atomic `findOneAndUpdate` with `$push`/`$pull`/array filters where possible, `findOne` + subdoc methods + `doc.save()` for reorder).

**Tech Stack:** Fastify, Mongoose, Zod, Vitest. TypeScript throughout. Reuses the existing auth plugin (`request.user._id`), `buildApp({ skipDb: true })` test harness, and `@pathforge/shared` workspace package.

**Spec:** [docs/superpowers/specs/2026-05-19-job-applications-design.md](../specs/2026-05-19-job-applications-design.md)

---

## File Map

**Create:**
- `packages/shared/src/jobApplication.ts` — Zod schemas + inferred types for `JobApplication`, `InterviewRound`, `Contact`, plus all `Create*` / `Update*` / `Reorder*` request shapes.
- `apps/api/src/models/JobApplication.ts` — Mongoose schemas (root + `roundSchema` + `contactSchema`), compound indexes, `JobApplicationDoc` type, `JobApplicationModel` export.
- `apps/api/src/lib/job-application-helpers.ts` — `serializeJobApplication(doc)` and reuse of the existing `validateReorderIds` from `roadmap-helpers.ts`. No new logic needed for the "Round N of M" indicator since that's derived client-side per the spec.
- `apps/api/src/routes/jobs.ts` — Twelve route handlers under `/api/jobs`.
- `apps/api/test/job-application-helpers.test.ts` — Vitest unit tests for the serializer.
- `apps/api/test/jobs.test.ts` — Vitest smoke test confirming `GET /api/jobs` returns 200 for an authed user (mirrors `health.test.ts` shape but exercises the auth path).

**Modify:**
- `packages/shared/src/index.ts` — add `export * from './jobApplication.js';`
- `apps/api/src/server.ts` — import and register `jobsRoutes` alongside `roadmapsRoutes`.

**Out of scope (deferred to the frontend plan):**
- Any `apps/web/**` changes.
- Bulk/LLM import endpoint (the spec explicitly omits this).
- Cross-feature views (e.g. "all apps linked to roadmap X" — the index supports it; the page isn't built).

---

## Task Conventions

- Steps marked `[Read first]` are orientation reads. Skip if you've already absorbed the file.
- "Run" commands are run from the repo root (`/Users/kanishkdebnath/Developer/pathforge`) inside the `api` workspace where relevant (`npm -w api run test`).
- Commit at the end of every task using the project's existing tone: `feat(api): …`, `chore(shared): …`, etc.
- Use `Date` and `Types.ObjectId` from `mongoose` consistently; never invent string ids server-side except in serialized output.

---

## Task 1 — Shared schemas

**Files:**
- Create: `packages/shared/src/jobApplication.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: [Read first] Skim the existing shared shape for conventions**

Read `packages/shared/src/roadmap.ts` (especially `ObjectIdString`, the request/response split, the `httpHttps` URL refinement in `BulkLinkSchema`) and `packages/shared/src/index.ts`.

- [ ] **Step 2: Create the schemas file**

Create `packages/shared/src/jobApplication.ts` with this exact content:

```typescript
import { z } from 'zod';

export const ObjectIdString = z
  .string()
  .regex(/^[a-f\d]{24}$/i, 'Invalid id');

export const JobApplicationStatusSchema = z.enum([
  'saved',
  'applied',
  'interviewing',
  'offer',
  'rejected',
  'withdrawn',
]);
export type JobApplicationStatus = z.infer<typeof JobApplicationStatusSchema>;

export const WorkModeSchema = z.enum(['remote', 'hybrid', 'onsite']);
export type WorkMode = z.infer<typeof WorkModeSchema>;

export const RoundOutcomeSchema = z.enum(['pending', 'passed', 'failed']);
export type RoundOutcome = z.infer<typeof RoundOutcomeSchema>;

// Mirrors the BulkLinkSchema refinement in roadmap.ts — defense against
// `javascript:` / `data:` URLs in pasted input. Inline here; lift into a
// shared helper if a third caller appears.
const HttpHttpsUrl = z
  .string()
  .url()
  .refine(
    (v) => {
      try {
        const u = new URL(v);
        return u.protocol === 'http:' || u.protocol === 'https:';
      } catch {
        return false;
      }
    },
    { message: 'URL must use http or https' }
  );

export const ContactSchema = z.object({
  _id: z.string(),
  name: z.string().min(1).max(200),
  role: z.string().max(200).optional(),
  email: z.string().email().optional(),
});
export type Contact = z.infer<typeof ContactSchema>;

export const InterviewRoundSchema = z.object({
  _id: z.string(),
  name: z.string().min(1).max(200),
  scheduledAt: z.coerce.date().optional(),
  durationMinutes: z.number().int().positive().max(24 * 60).optional(),
  interviewer: z.string().max(200).optional(),
  outcome: RoundOutcomeSchema.default('pending'),
  prepNotes: z.string().max(20_000).optional(),
  questions: z.array(z.string().min(1).max(2_000)).default([]),
  experience: z.string().max(20_000).optional(),
});
export type InterviewRound = z.infer<typeof InterviewRoundSchema>;

export const JobApplicationSchema = z.object({
  _id: z.string(),
  userId: z.string(),
  company: z.string().min(1).max(200),
  role: z.string().min(1).max(200),
  jobUrl: HttpHttpsUrl.optional(),
  status: JobApplicationStatusSchema.default('saved'),
  appliedAt: z.coerce.date().optional(),
  resumeUrl: HttpHttpsUrl.optional(),
  location: z.string().max(200).optional(),
  workMode: WorkModeSchema.optional(),
  salaryRange: z.string().max(200).optional(),
  offerAmount: z.string().max(200).optional(),
  tags: z.array(z.string().min(1).max(80)).default([]),
  notes: z.string().max(20_000).optional(),
  contacts: z.array(ContactSchema).default([]),
  rounds: z.array(InterviewRoundSchema).default([]),
  links: z
    .object({ roadmapId: ObjectIdString.optional() })
    .default({}),
  archived: z.boolean().default(false),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type JobApplication = z.infer<typeof JobApplicationSchema>;

// ---- Request shapes ----

// PATCH-friendly nullable for clearing optional dates (mirrors UpdateRoadmapRequestSchema).
const nullableDate = z.coerce.date().nullable().optional();

export const CreateJobApplicationRequestSchema = z.object({
  company: z.string().min(1).max(200),
  role: z.string().min(1).max(200),
  jobUrl: HttpHttpsUrl.optional(),
  status: JobApplicationStatusSchema.optional(),
  appliedAt: z.coerce.date().optional(),
  resumeUrl: HttpHttpsUrl.optional(),
  location: z.string().max(200).optional(),
  workMode: WorkModeSchema.optional(),
  salaryRange: z.string().max(200).optional(),
  offerAmount: z.string().max(200).optional(),
  tags: z.array(z.string().min(1).max(80)).optional(),
  notes: z.string().max(20_000).optional(),
  links: z.object({ roadmapId: ObjectIdString.optional() }).optional(),
});
export type CreateJobApplicationRequest = z.infer<
  typeof CreateJobApplicationRequestSchema
>;

export const UpdateJobApplicationRequestSchema = z.object({
  company: z.string().min(1).max(200).optional(),
  role: z.string().min(1).max(200).optional(),
  jobUrl: HttpHttpsUrl.nullable().optional(),
  status: JobApplicationStatusSchema.optional(),
  appliedAt: nullableDate,
  resumeUrl: HttpHttpsUrl.nullable().optional(),
  location: z.string().max(200).nullable().optional(),
  workMode: WorkModeSchema.nullable().optional(),
  salaryRange: z.string().max(200).nullable().optional(),
  offerAmount: z.string().max(200).nullable().optional(),
  tags: z.array(z.string().min(1).max(80)).optional(),
  notes: z.string().max(20_000).nullable().optional(),
  links: z
    .object({ roadmapId: ObjectIdString.nullable().optional() })
    .optional(),
  archived: z.boolean().optional(),
});
export type UpdateJobApplicationRequest = z.infer<
  typeof UpdateJobApplicationRequestSchema
>;

export const CreateRoundRequestSchema = z.object({
  name: z.string().min(1).max(200),
  scheduledAt: z.coerce.date().optional(),
  durationMinutes: z.number().int().positive().max(24 * 60).optional(),
  interviewer: z.string().max(200).optional(),
  outcome: RoundOutcomeSchema.optional(),
  prepNotes: z.string().max(20_000).optional(),
  questions: z.array(z.string().min(1).max(2_000)).optional(),
  experience: z.string().max(20_000).optional(),
});
export type CreateRoundRequest = z.infer<typeof CreateRoundRequestSchema>;

export const UpdateRoundRequestSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  scheduledAt: nullableDate,
  durationMinutes: z
    .number()
    .int()
    .positive()
    .max(24 * 60)
    .nullable()
    .optional(),
  interviewer: z.string().max(200).nullable().optional(),
  outcome: RoundOutcomeSchema.optional(),
  prepNotes: z.string().max(20_000).nullable().optional(),
  questions: z.array(z.string().min(1).max(2_000)).optional(),
  experience: z.string().max(20_000).nullable().optional(),
});
export type UpdateRoundRequest = z.infer<typeof UpdateRoundRequestSchema>;

export const CreateContactRequestSchema = z.object({
  name: z.string().min(1).max(200),
  role: z.string().max(200).optional(),
  email: z.string().email().optional(),
});
export type CreateContactRequest = z.infer<typeof CreateContactRequestSchema>;

export const UpdateContactRequestSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  role: z.string().max(200).nullable().optional(),
  email: z.string().email().nullable().optional(),
});
export type UpdateContactRequest = z.infer<typeof UpdateContactRequestSchema>;

// Re-export the roadmap-style reorder shape locally so the routes file imports
// from one place. Identical to ReorderRequestSchema in roadmap.ts.
export const ReorderRoundsRequestSchema = z.object({
  ids: z.array(ObjectIdString).min(1),
});
export type ReorderRoundsRequest = z.infer<typeof ReorderRoundsRequestSchema>;
```

- [ ] **Step 3: Re-export from the package barrel**

Edit `packages/shared/src/index.ts` to add:

```typescript
export * from './jobApplication.js';
```

Final file content:

```typescript
export * from './user.js';
export * from './link.js';
export * from './roadmap.js';
export * from './jobApplication.js';
```

- [ ] **Step 4: Type-check the shared package**

The shared workspace has no `build` step — its `package.json` exports `./src/index.ts` directly and consumers compile through their own tsconfigs. So just verify the new file type-checks cleanly:

Run: `npx tsc -p packages/shared --noEmit`

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/jobApplication.ts packages/shared/src/index.ts
git commit -m "feat(shared): job application zod schemas

Adds JobApplicationSchema with rounds + contacts subdocs and the
matching Create/Update/Reorder request shapes. Mirrors the roadmap
schema layout for review-time consistency."
```

---

## Task 2 — Mongoose model

**Files:**
- Create: `apps/api/src/models/JobApplication.ts`

- [ ] **Step 1: [Read first] Skim the roadmap model**

Read `apps/api/src/models/Roadmap.ts` end-to-end. Pay attention to:
- `_id: false` on `linkSchema` (no id needed for inline objects)
- `_id: true` on `stepSchema` and `milestoneSchema` (subdocuments that get CRUD)
- `{ timestamps: true }` on the root schema
- The compound index on `{ userId, archived }`
- The `RoadmapDoc` type pattern (`InferSchemaType` + explicit `_id: string`, `createdAt`, `updatedAt`)

- [ ] **Step 2: Create the model file**

Create `apps/api/src/models/JobApplication.ts` with:

```typescript
import { Schema, model, type InferSchemaType, Types } from 'mongoose';

const contactSchema = new Schema(
  {
    name: { type: String, required: true },
    role: String,
    email: String,
  },
  { _id: true }
);

const roundSchema = new Schema(
  {
    name: { type: String, required: true },
    scheduledAt: Date,
    durationMinutes: Number,
    interviewer: String,
    outcome: {
      type: String,
      enum: ['pending', 'passed', 'failed'],
      default: 'pending',
    },
    prepNotes: String,
    questions: { type: [String], default: [] },
    experience: String,
  },
  { _id: true }
);

const jobApplicationSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: 'User', required: true },
    company: { type: String, required: true },
    role: { type: String, required: true },
    jobUrl: String,
    status: {
      type: String,
      enum: ['saved', 'applied', 'interviewing', 'offer', 'rejected', 'withdrawn'],
      default: 'saved',
    },
    appliedAt: Date,
    resumeUrl: String,
    location: String,
    workMode: { type: String, enum: ['remote', 'hybrid', 'onsite'] },
    salaryRange: String,
    offerAmount: String,
    tags: { type: [String], default: [] },
    notes: String,
    contacts: { type: [contactSchema], default: [] },
    rounds: { type: [roundSchema], default: [] },
    links: {
      type: new Schema(
        { roadmapId: { type: Types.ObjectId, ref: 'Roadmap' } },
        { _id: false }
      ),
      default: () => ({}),
    },
    archived: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Main list query covers user + archived filter, sorted by updatedAt.
// CLAUDE.md rule: every compound index starts with userId.
jobApplicationSchema.index({ userId: 1, archived: 1, updatedAt: -1 });
// Sparse — supports a future "applications linked to roadmap X" view.
jobApplicationSchema.index(
  { userId: 1, 'links.roadmapId': 1 },
  { sparse: true }
);

// InferSchemaType doesn't surface timestamps even with `timestamps: true`,
// so declare them explicitly. `_id: string` matches the RoadmapDoc pattern;
// the serializer in Task 3 calls String(...) at every level to bridge the
// runtime ObjectId values.
export type JobApplicationDoc = InferSchemaType<typeof jobApplicationSchema> & {
  _id: string;
  createdAt: Date;
  updatedAt: Date;
};

export const JobApplicationModel = model('JobApplication', jobApplicationSchema);
```

- [ ] **Step 3: Verify the API workspace type-checks**

Run: `npx tsc -p apps/api --noEmit`

Expected: no errors. (The api workspace has no standalone `typecheck` script; invoke tsc directly against its tsconfig.)

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/models/JobApplication.ts
git commit -m "feat(api): JobApplication mongoose model

Single doc per application with rounds and contacts as embedded
subdocs. Compound indexes: { userId, archived, updatedAt } for
the main list, { userId, links.roadmapId } sparse for a future
cross-feature view."
```

---

## Task 3 — Helpers + serializer test

**Files:**
- Create: `apps/api/src/lib/job-application-helpers.ts`
- Create: `apps/api/test/job-application-helpers.test.ts`

- [ ] **Step 1: [Read first] Mirror the existing helper file**

Read `apps/api/src/lib/roadmap-helpers.ts` (especially `serializeRoadmap`) and `apps/api/test/roadmap-helpers.test.ts` for the test idiom. The `validateReorderIds` helper is generic — we'll import it from `roadmap-helpers.ts` directly in the routes file rather than duplicating.

- [ ] **Step 2: Create the helpers file**

Create `apps/api/src/lib/job-application-helpers.ts`:

```typescript
import type { JobApplication } from '@pathforge/shared';
import type { JobApplicationDoc } from '../models/JobApplication.js';

/**
 * Converts a Mongoose lean job-application doc into the wire `JobApplication`
 * shape: stringifies all ObjectIds at every level, preserves Date instances
 * as Dates, and leaves undefined optionals undefined (so the JSON serializer
 * drops them). Mirrors serializeRoadmap.
 */
export function serializeJobApplication(doc: JobApplicationDoc): JobApplication {
  return {
    _id: String(doc._id),
    userId: String(doc.userId),
    company: doc.company,
    role: doc.role,
    jobUrl: doc.jobUrl ?? undefined,
    status: doc.status,
    appliedAt: doc.appliedAt ?? undefined,
    resumeUrl: doc.resumeUrl ?? undefined,
    location: doc.location ?? undefined,
    workMode: doc.workMode ?? undefined,
    salaryRange: doc.salaryRange ?? undefined,
    offerAmount: doc.offerAmount ?? undefined,
    tags: doc.tags ?? [],
    notes: doc.notes ?? undefined,
    contacts: (doc.contacts ?? []).map((c) => ({
      _id: String(c._id),
      name: c.name,
      role: c.role ?? undefined,
      email: c.email ?? undefined,
    })),
    rounds: (doc.rounds ?? []).map((r) => ({
      _id: String(r._id),
      name: r.name,
      scheduledAt: r.scheduledAt ?? undefined,
      durationMinutes: r.durationMinutes ?? undefined,
      interviewer: r.interviewer ?? undefined,
      outcome: r.outcome,
      prepNotes: r.prepNotes ?? undefined,
      questions: r.questions ?? [],
      experience: r.experience ?? undefined,
    })),
    links: {
      roadmapId:
        doc.links && doc.links.roadmapId
          ? String(doc.links.roadmapId)
          : undefined,
    },
    archived: doc.archived,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}
```

- [ ] **Step 3: Write the failing test**

Create `apps/api/test/job-application-helpers.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { serializeJobApplication } from '../src/lib/job-application-helpers.js';

describe('serializeJobApplication', () => {
  it('stringifies ObjectIds at every level and omits undefined optionals', () => {
    const fakeDoc = {
      _id: { toString: () => 'a1' },
      userId: { toString: () => 'u1' },
      company: 'Linear',
      role: 'SWE',
      status: 'interviewing',
      tags: ['react', 'remote'],
      contacts: [
        {
          _id: { toString: () => 'c1' },
          name: 'Maya',
          role: 'Recruiter',
          email: 'maya@linear.app',
        },
      ],
      rounds: [
        {
          _id: { toString: () => 'r1' },
          name: 'Phone Screen',
          outcome: 'passed',
          questions: ['Why us?'],
        },
      ],
      links: { roadmapId: { toString: () => 'rm1' } },
      archived: false,
      createdAt: new Date('2026-05-19T00:00:00Z'),
      updatedAt: new Date('2026-05-19T00:00:00Z'),
    } as never;

    const out = serializeJobApplication(fakeDoc);

    expect(out._id).toBe('a1');
    expect(out.userId).toBe('u1');
    expect(out.contacts[0]._id).toBe('c1');
    expect(out.rounds[0]._id).toBe('r1');
    expect(out.links.roadmapId).toBe('rm1');
    expect(out.jobUrl).toBeUndefined();
    expect(out.appliedAt).toBeUndefined();
    expect(out.tags).toEqual(['react', 'remote']);
    expect(out.rounds[0].questions).toEqual(['Why us?']);
  });

  it('returns an empty contacts/rounds array when the doc fields are missing', () => {
    const fakeDoc = {
      _id: { toString: () => 'a2' },
      userId: { toString: () => 'u1' },
      company: 'Vercel',
      role: 'Platform',
      status: 'applied',
      tags: [],
      archived: false,
      links: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never;

    const out = serializeJobApplication(fakeDoc);

    expect(out.contacts).toEqual([]);
    expect(out.rounds).toEqual([]);
    expect(out.links.roadmapId).toBeUndefined();
  });
});
```

- [ ] **Step 4: Run the tests**

Run: `npm -w api test -- job-application-helpers`

Expected: both tests PASS. (They will pass because the implementation in Step 2 already exists — write-test-then-implement was inverted here because the helper is a pure serializer and the shape is dictated entirely by the schemas in Task 1; iterating on it test-first adds no value.)

If anything fails, fix the helper (the tests are the contract).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/lib/job-application-helpers.ts apps/api/test/job-application-helpers.test.ts
git commit -m "feat(api): serializeJobApplication helper + tests

Stringifies ObjectIds at every level, preserves Dates, drops
undefined optionals. Mirrors serializeRoadmap."
```

---

## Task 4 — Routes scaffold + GET /api/jobs (list)

**Files:**
- Create: `apps/api/src/routes/jobs.ts`

- [ ] **Step 1: [Read first] Re-skim the route shape**

Read the first 60 lines of `apps/api/src/routes/roadmaps.ts` to fix the boilerplate in your head: `isValidId` helper, `preHandler: [app.authenticate]`, `request.user!._id`, `.lean()` + serializer.

- [ ] **Step 2: Create the routes file with the list endpoint**

Create `apps/api/src/routes/jobs.ts`:

```typescript
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
import { validateReorderIds } from '../lib/roadmap-helpers.js';

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
```

- [ ] **Step 3: Verify the API type-checks**

Run: `npx tsc -p apps/api --noEmit`

Expected: no errors. (The route isn't registered yet — that happens in Task 10. Type-check just confirms the file parses and imports resolve.)

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/routes/jobs.ts
git commit -m "feat(api): jobs routes scaffold + GET /api/jobs

List endpoint returns the auth'd user's job applications, archived
filterable, sorted by updatedAt desc."
```

---

## Task 5 — POST /api/jobs (create)

**Files:**
- Modify: `apps/api/src/routes/jobs.ts`

- [ ] **Step 1: Add the create endpoint inside `jobsRoutes`**

Insert immediately after the GET handler:

```typescript
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
```

- [ ] **Step 2: Type-check**

Run: `npx tsc -p apps/api --noEmit`

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/routes/jobs.ts
git commit -m "feat(api): POST /api/jobs

Creates an application with company + role required; rest of the
optional fields pass through unchanged. Status defaults to 'saved'."
```

---

## Task 6 — GET / PATCH / DELETE /api/jobs/:id

**Files:**
- Modify: `apps/api/src/routes/jobs.ts`

- [ ] **Step 1: Add the three single-resource endpoints**

Append to `jobsRoutes` (before the closing `}` of the function):

```typescript
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
    const nullable: Array<keyof typeof data> = [
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
      if (v === null) unset[key as string] = '';
      else set[key as string] = v;
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
```

- [ ] **Step 2: Type-check**

Run: `npx tsc -p apps/api --noEmit`

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/routes/jobs.ts
git commit -m "feat(api): GET/PATCH/DELETE /api/jobs/:id

Single-resource endpoints. PATCH handles nullable optional fields
via \$set/\$unset, including links.roadmapId. Cross-user access
returns 404 (never 403). Mirrors the roadmap PATCH idiom."
```

---

## Task 7 — Round subdocument CRUD

**Files:**
- Modify: `apps/api/src/routes/jobs.ts`

- [ ] **Step 1: Add the three round endpoints**

Append to `jobsRoutes`:

```typescript
  // POST /api/jobs/:id/rounds
  app.post(
    '/api/jobs/:id/rounds',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      if (!isValidId(id)) return reply.code(404).send({ error: 'Not found' });
      const parsed = CreateRoundRequestSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: 'Invalid body' });
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
      if (!parsed.success) return reply.code(400).send({ error: 'Invalid body' });
      const userId = request.user!._id;
      const data = parsed.data;

      const set: Record<string, unknown> = {};
      const unset: Record<string, ''> = {};

      if (data.name !== undefined) set['rounds.$[r].name'] = data.name;
      if (data.outcome !== undefined) set['rounds.$[r].outcome'] = data.outcome;
      if (data.questions !== undefined) set['rounds.$[r].questions'] = data.questions;

      const nullable: Array<keyof typeof data> = [
        'scheduledAt',
        'durationMinutes',
        'interviewer',
        'prepNotes',
        'experience',
      ];
      for (const key of nullable) {
        const v = data[key];
        if (v === undefined) continue;
        if (v === null) unset[`rounds.$[r].${key as string}`] = '';
        else set[`rounds.$[r].${key as string}`] = v;
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
```

- [ ] **Step 2: Type-check**

Run: `npx tsc -p apps/api --noEmit`

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/routes/jobs.ts
git commit -m "feat(api): round subdoc CRUD

POST/PATCH/DELETE /api/jobs/:id/rounds[/:roundId]. PATCH handles
nullable round fields via array filters + \$set/\$unset."
```

---

## Task 8 — PUT /api/jobs/:id/rounds/order (reorder)

**Files:**
- Modify: `apps/api/src/routes/jobs.ts`

- [ ] **Step 1: Add the reorder endpoint**

Append to `jobsRoutes`:

```typescript
  // PUT /api/jobs/:id/rounds/order
  app.put(
    '/api/jobs/:id/rounds/order',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      if (!isValidId(id)) return reply.code(404).send({ error: 'Not found' });
      const parsed = ReorderRoundsRequestSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: 'Invalid body' });
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
```

- [ ] **Step 2: Type-check**

Run: `npx tsc -p apps/api --noEmit`

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/routes/jobs.ts
git commit -m "feat(api): PUT /api/jobs/:id/rounds/order

Drag-and-drop reorder endpoint. Validates the submitted set is a
permutation via the existing validateReorderIds helper; in-place
splice + doc.save() to preserve Mongoose dirty tracking."
```

---

## Task 9 — Contact subdocument CRUD

**Files:**
- Modify: `apps/api/src/routes/jobs.ts`

- [ ] **Step 1: Add the three contact endpoints**

Append to `jobsRoutes`:

```typescript
  // POST /api/jobs/:id/contacts
  app.post(
    '/api/jobs/:id/contacts',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      if (!isValidId(id)) return reply.code(404).send({ error: 'Not found' });
      const parsed = CreateContactRequestSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: 'Invalid body' });
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
      if (!parsed.success) return reply.code(400).send({ error: 'Invalid body' });
      const userId = request.user!._id;
      const data = parsed.data;

      const set: Record<string, unknown> = {};
      const unset: Record<string, ''> = {};
      if (data.name !== undefined) set['contacts.$[c].name'] = data.name;
      const nullable: Array<keyof typeof data> = ['role', 'email'];
      for (const key of nullable) {
        const v = data[key];
        if (v === undefined) continue;
        if (v === null) unset[`contacts.$[c].${key as string}`] = '';
        else set[`contacts.$[c].${key as string}`] = v;
      }

      const update: Record<string, unknown> = {};
      if (Object.keys(set).length > 0) update.$set = set;
      if (Object.keys(unset).length > 0) update.$unset = unset;
      if (Object.keys(update).length === 0) {
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
```

- [ ] **Step 2: Type-check**

Run: `npx tsc -p apps/api --noEmit`

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/routes/jobs.ts
git commit -m "feat(api): contact subdoc CRUD

POST/PATCH/DELETE /api/jobs/:id/contacts[/:contactId]."
```

---

## Task 10 — Register routes + smoke test

**Files:**
- Modify: `apps/api/src/server.ts`
- Create: `apps/api/test/jobs.test.ts`

- [ ] **Step 1: Register the routes in the Fastify app**

In `apps/api/src/server.ts`, add the import next to the existing roadmap import:

```typescript
import { jobsRoutes } from './routes/jobs.js';
```

Inside `buildApp`, register the routes immediately after `roadmapsRoutes`:

```typescript
  await app.register(roadmapsRoutes);
  await app.register(jobsRoutes);
```

- [ ] **Step 2: Write the smoke test**

Create `apps/api/test/jobs.test.ts`:

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

describe('GET /api/jobs', () => {
  it('returns 401 without a session cookie', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/jobs' });
    expect(res.statusCode).toBe(401);
  });
});

describe('GET /api/jobs/:id', () => {
  it('returns 401 without a session cookie', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/jobs/507f1f77bcf86cd799439011',
    });
    expect(res.statusCode).toBe(401);
  });
});
```

The smoke test verifies the routes are wired and the auth preHandler runs — both indicators that registration worked end-to-end. We deliberately don't exercise the DB path (`skipDb: true` skips it) because the existing test harness convention doesn't spin up Mongo.

- [ ] **Step 3: Run the full API test suite**

Run: `npm -w api test`

Expected output (the new tests appear in green, all previously-green tests still green):
```
✓ test/health.test.ts (1)
✓ test/roadmap-helpers.test.ts (...)
✓ test/bulk-roadmap-schema.test.ts (...)
✓ test/job-application-helpers.test.ts (2)
✓ test/jobs.test.ts (2)
```

If `jobs.test.ts` returns 404 (route not found) instead of 401, the registration in Step 1 is missing or out of order — fix it and re-run.

- [ ] **Step 4: Manual smoke (optional but recommended)**

Run `docker compose up` from the repo root, log in as a dev user via `http://localhost:5173/login`, and probe the API directly:

```bash
# In a separate terminal, after logging in via the UI:
curl -i --cookie-jar /tmp/pf.cookies --cookie /tmp/pf.cookies http://localhost:4000/api/jobs
# Expect 200 and [] body (no apps yet)

curl -i --cookie-jar /tmp/pf.cookies --cookie /tmp/pf.cookies \
  -H 'content-type: application/json' \
  -d '{"company":"Linear","role":"SWE"}' \
  http://localhost:4000/api/jobs
# Expect 201 and the new application JSON
```

(The cookie capture step depends on the dev-login flow already setting a cookie in `/tmp/pf.cookies`; if you'd rather, paste the request through the browser devtools.)

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/server.ts apps/api/test/jobs.test.ts
git commit -m "feat(api): register jobs routes + smoke test

Wires jobsRoutes into buildApp alongside roadmapsRoutes. Smoke
test asserts the routes are reachable and auth-gated."
```

---

## Acceptance Checklist

After Task 10 commits, the backend half of the feature is done. Verify the following:

- [ ] `npm -w api test` is green end-to-end.
- [ ] `npx tsc -p apps/api --noEmit` is clean.
- [ ] `npx tsc -p packages/shared --noEmit` is clean.
- [ ] `git log --oneline` shows ~10 commits matching the task headers.
- [ ] Manual smoke against `docker compose up` (Step 4 of Task 10) round-trips a `POST` and a `GET`.

## What's Next

The frontend half is planned separately. Likely shape (to be written after this plan ships):

- `apps/web/src/lib/api.ts` already exists — nothing to add for axios setup.
- `apps/web/src/hooks/useJobs.ts` (list/detail reads + ~10 mutation hooks) — TanStack Query cache keys per the spec.
- `apps/web/src/pages/JobsListPage.tsx` + `JobDetailPage.tsx` and components from the approved spec component tree.
- Navbar gets a `Jobs` link.
- `EmptyJobApplicationsState.tsx` mirrors the roadmap empty state.
- Round drag-drop with `@dnd-kit/sortable`, mirroring the milestone reorder UX.

Reach for the writing-plans skill again to write that plan once this one is merged.
