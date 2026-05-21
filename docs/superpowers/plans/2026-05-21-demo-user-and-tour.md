# Demo User and Onboarding Tour Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dedicated "Pathfinder Demo" user whose data is wiped and reseeded from a showcase fixture on every login, plus a side-panel tour that auto-opens for that user and walks through Roadmaps then Jobs.

**Architecture:** Backend stores an `isDemoUser` boolean on the user document; the login handler awaits a `resetDemoData(userId)` call when that flag is set, before issuing the session cookie. Frontend reads `me.isDemoUser` from the existing `/api/auth/me` response and conditionally mounts a `TourProvider` + side-panel `TourPanel` over the protected routes. All tour state is in-memory; no localStorage, no new endpoints.

**Tech Stack:** TypeScript, Zod, Fastify, Mongoose, React + Vite, TanStack Query, react-router, shadcn/ui, Tailwind, Vitest.

**Spec:** [docs/superpowers/specs/2026-05-21-demo-user-and-tour-design.md](../specs/2026-05-21-demo-user-and-tour-design.md)

**Spec deviations** (called out so reviewers can sanity-check):

- The spec asks for two integration tests that hit Mongo (`POST /api/auth/login` as demo user → assert document counts; non-demo login → assert no data touched). The existing api test suite is `skipDb: true` only — there is no real-DB or in-memory-Mongo harness. Rather than add that infrastructure for one feature, this plan substitutes **unit tests on `getDemoFixtures`** (Task 5) for the fixture-shape contract, and the **manual verification cycle** in Task 15 for the wipe-and-reseed behavior. If you want the integration tests later, that's a follow-up that introduces `mongodb-memory-server` once and benefits every future API test.
- The spec listed the round outcome `'scheduled'`; the actual Mongoose enum is `'pending' | 'passed' | 'failed'`. The fixture in Task 5 uses `'pending'` for future-dated rounds.
- The spec said job status `'interview'`; the actual enum value is `'interviewing'`. The fixture and tests use `'interviewing'`.
- The spec referenced a roadmap `status` field; the actual model only has `archived: boolean`. Active vs done is implicit in step completion; archived/not is the single field.

---

## File Map

**Created**
- `apps/api/src/seedDemo.ts` — exports `getDemoFixtures(userId)` and `resetDemoData(userId)`.
- `apps/api/test/seed-demo.test.ts` — unit tests for the fixture shape.
- `apps/web/src/components/tour/tourSteps.ts` — `TourStep` type and `TOUR_STEPS` constant.
- `apps/web/src/components/tour/TourProvider.tsx` — React context with `open`, `completedStepIds`, `currentStepId`, actions.
- `apps/web/src/components/tour/TourPanel.tsx` — fixed-position side dock + "Resume tour" pill.
- `apps/web/src/components/tour/DemoBadge.tsx` — small "Demo Mode" pill.

**Modified**
- `packages/shared/src/user.ts` — add `isDemoUser` to `UserSchema`.
- `apps/api/src/models/User.ts` — add `isDemoUser` to the Mongoose schema.
- `apps/api/src/plugins/auth.ts` — pass `isDemoUser` through to `req.user`.
- `apps/api/src/seed.ts` — append a fourth dev user `Pathfinder Demo` with `isDemoUser: true`.
- `apps/api/src/routes/auth.ts` — call `resetDemoData` inside `POST /api/auth/login` when `user.isDemoUser`.
- `apps/web/src/components/Navbar.tsx` — render `<DemoBadge />` next to the user name and add a "Restart tour" item to the avatar dropdown when `me.isDemoUser`.
- `apps/web/src/App.tsx` — wrap protected routes with `<TourProvider>` and mount `<TourPanel />` once.
- `docs/PROJECT.md` — Changelog entry + Auth Strategy note.

---

## Task 1: Add `isDemoUser` to shared `UserSchema`

**Files:**
- Modify: `packages/shared/src/user.ts`

- [ ] **Step 1: Add the field**

Edit `packages/shared/src/user.ts`. Insert `isDemoUser` after `googleId`:

```ts
import { z } from 'zod';

export const UserSchema = z.object({
  _id: z.string(),
  email: z.string().email(),
  name: z.string().min(1),
  avatarUrl: z.string().url().optional(),
  googleId: z.string().optional(),
  isDemoUser: z.boolean().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type User = z.infer<typeof UserSchema>;

export const LoginRequestSchema = z.object({
  userId: z.string().regex(/^[a-f\d]{24}$/i),
});

export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const DevUserSchema = UserSchema.pick({
  _id: true,
  email: true,
  name: true,
  avatarUrl: true,
});

export type DevUser = z.infer<typeof DevUserSchema>;
```

(Note: `DevUserSchema` does **not** include `isDemoUser`. The login dropdown does not need to distinguish demo users — the dropdown just lists `name`.)

- [ ] **Step 2: Type-check the shared package**

Run: `npm -w @pathforge/shared run build`
Expected: build completes with no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/user.ts
git commit -m "feat(shared): add isDemoUser to UserSchema"
```

---

## Task 2: Add `isDemoUser` to the Mongoose user model

**Files:**
- Modify: `apps/api/src/models/User.ts`

- [ ] **Step 1: Add the field**

Edit `apps/api/src/models/User.ts`:

```ts
import { Schema, model, type InferSchemaType } from 'mongoose';

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    avatarUrl: { type: String },
    googleId: { type: String, index: true, sparse: true },
    isDemoUser: { type: Boolean, default: false },
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

- [ ] **Step 2: Type-check the api package**

Run: `npm -w @pathforge/api run typecheck`
Expected: completes with no errors. (If the `typecheck` script doesn't exist, use `npx tsc --noEmit -p apps/api/tsconfig.json` from the repo root.)

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/models/User.ts
git commit -m "feat(api): add isDemoUser to user Mongoose schema"
```

---

## Task 3: Pass `isDemoUser` through the auth plugin to `req.user`

**Files:**
- Modify: `apps/api/src/plugins/auth.ts`

- [ ] **Step 1: Add the field to the mapping**

Edit `apps/api/src/plugins/auth.ts`. In the `authenticate` decorator, update the `request.user` assignment to include `isDemoUser`:

```ts
request.user = {
  _id: String(user._id),
  email: user.email,
  name: user.name,
  avatarUrl: user.avatarUrl ?? undefined,
  googleId: user.googleId ?? undefined,
  isDemoUser: user.isDemoUser ?? false,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
};
```

This is the only change to the file — everything else stays as-is.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit -p apps/api/tsconfig.json`
Expected: no errors. The `User` type from `@pathforge/shared` now has `isDemoUser?: boolean`, matching the assignment.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/plugins/auth.ts
git commit -m "feat(api): expose isDemoUser on req.user"
```

---

## Task 4: Seed the `Pathfinder Demo` user

**Files:**
- Modify: `apps/api/src/seed.ts`

- [ ] **Step 1: Append the fourth dev user**

Edit `apps/api/src/seed.ts`:

```ts
import { UserModel } from './models/User.js';

const DEV_USERS = [
  {
    email: 'ada@pathforge.dev',
    name: 'Ada Lovelace',
    avatarUrl: 'https://api.dicebear.com/9.x/initials/svg?seed=Ada%20Lovelace',
  },
  {
    email: 'alan@pathforge.dev',
    name: 'Alan Turing',
    avatarUrl: 'https://api.dicebear.com/9.x/initials/svg?seed=Alan%20Turing',
  },
  {
    email: 'grace@pathforge.dev',
    name: 'Grace Hopper',
    avatarUrl: 'https://api.dicebear.com/9.x/initials/svg?seed=Grace%20Hopper',
  },
  {
    email: 'demo@pathforge.dev',
    name: 'Pathfinder Demo',
    avatarUrl: 'https://api.dicebear.com/9.x/initials/svg?seed=Pathfinder%20Demo',
    isDemoUser: true,
  },
];

export async function seedDevUsersIfEmpty(): Promise<void> {
  const count = await UserModel.estimatedDocumentCount();
  if (count > 0) return;
  await UserModel.insertMany(DEV_USERS);
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit -p apps/api/tsconfig.json`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/seed.ts
git commit -m "feat(api): seed Pathfinder Demo dev user"
```

---

## Task 5: Demo fixtures builder (`getDemoFixtures`) — with unit tests

**Files:**
- Create: `apps/api/src/seedDemo.ts`
- Create: `apps/api/test/seed-demo.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/api/test/seed-demo.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { Types } from 'mongoose';
import { getDemoFixtures } from '../src/seedDemo.js';

const userId = new Types.ObjectId();

describe('getDemoFixtures', () => {
  const { roadmaps, jobs } = getDemoFixtures(userId);

  it('returns 3 roadmaps and 5 jobs', () => {
    expect(roadmaps).toHaveLength(3);
    expect(jobs).toHaveLength(5);
  });

  it('stamps userId on every roadmap and job', () => {
    for (const r of roadmaps) expect(String(r.userId)).toBe(String(userId));
    for (const j of jobs) expect(String(j.userId)).toBe(String(userId));
  });

  it('includes the showcase roadmap titles', () => {
    const titles = roadmaps.map((r) => r.title).sort();
    expect(titles).toEqual(
      [
        'Land a senior backend role',
        'Learn Rust for systems work',
        'Ship Pathforge v0',
      ].sort()
    );
  });

  it('marks "Ship Pathforge v0" as archived and the other two as active', () => {
    const byTitle = Object.fromEntries(roadmaps.map((r) => [r.title, r]));
    expect(byTitle['Ship Pathforge v0'].archived).toBe(true);
    expect(byTitle['Learn Rust for systems work'].archived).toBe(false);
    expect(byTitle['Land a senior backend role'].archived).toBe(false);
  });

  it('includes the showcase company / status pairs', () => {
    const pairs = jobs.map((j) => `${j.company}:${j.status}`).sort();
    expect(pairs).toEqual(
      [
        'Anthropic:offer',
        'Figma:rejected',
        'Linear:interviewing',
        'Stripe:applied',
        'Vercel:saved',
      ].sort()
    );
  });

  it('links the Linear interview job to the backend-role roadmap', () => {
    const backendRoadmap = roadmaps.find(
      (r) => r.title === 'Land a senior backend role'
    )!;
    const linear = jobs.find((j) => j.company === 'Linear')!;
    expect(String(linear.links.roadmapId)).toBe(String(backendRoadmap._id));
  });

  it('uses only valid round outcomes', () => {
    const allowed = new Set(['pending', 'passed', 'failed']);
    for (const j of jobs) {
      for (const r of j.rounds ?? []) {
        expect(allowed.has(r.outcome)).toBe(true);
      }
    }
  });
});
```

- [ ] **Step 2: Run the test, expect failure**

Run: `npm -w @pathforge/api run test -- seed-demo`
Expected: FAIL with module resolution error (`Cannot find module '../src/seedDemo.js'`).

- [ ] **Step 3: Implement `getDemoFixtures`**

Create `apps/api/src/seedDemo.ts`:

```ts
import { Types } from 'mongoose';

export type RoadmapSeed = {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  title: string;
  description?: string;
  archived: boolean;
  milestones: Array<{
    _id: Types.ObjectId;
    title: string;
    description?: string;
    steps: Array<{
      _id: Types.ObjectId;
      title: string;
      completed: boolean;
      completedAt?: Date;
      links: Array<{ url: string; label?: string }>;
    }>;
    completedAt?: Date;
  }>;
};

export type JobSeed = {
  userId: Types.ObjectId;
  company: string;
  role: string;
  jobUrl?: string;
  status: 'saved' | 'applied' | 'interviewing' | 'offer' | 'rejected' | 'withdrawn';
  appliedAt?: Date;
  location?: string;
  workMode?: 'remote' | 'hybrid' | 'onsite';
  salaryRange?: string;
  offerAmount?: string;
  tags: string[];
  notes?: string;
  contacts: Array<{ name: string; role?: string; email?: string }>;
  rounds: Array<{
    name: string;
    scheduledAt?: Date;
    durationMinutes?: number;
    interviewer?: string;
    outcome: 'pending' | 'passed' | 'failed';
    prepNotes?: string;
    questions: string[];
    experience?: string;
  }>;
  links: { roadmapId?: Types.ObjectId };
  archived: boolean;
};

const daysAgo = (n: number): Date => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
};

const daysFromNow = (n: number): Date => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
};

const oid = () => new Types.ObjectId();

function buildRoadmaps(userId: Types.ObjectId): {
  rust: RoadmapSeed;
  backend: RoadmapSeed;
  pathforge: RoadmapSeed;
} {
  const rust: RoadmapSeed = {
    _id: oid(),
    userId,
    title: 'Learn Rust for systems work',
    description:
      "Become comfortable enough with Rust to write production-quality CLI tools and async services. The goal isn't mastery — it's confidence to ship.",
    archived: false,
    milestones: [
      {
        _id: oid(),
        title: 'Read The Book Ch 1–10',
        steps: [
          { _id: oid(), title: 'Ownership & borrowing', completed: true, completedAt: daysAgo(40), links: [] },
          { _id: oid(), title: 'Structs & enums', completed: true, completedAt: daysAgo(38), links: [] },
          { _id: oid(), title: 'Error handling with Result', completed: true, completedAt: daysAgo(35), links: [] },
          { _id: oid(), title: 'Traits & generics', completed: true, completedAt: daysAgo(30), links: [] },
        ],
        completedAt: daysAgo(30),
      },
      {
        _id: oid(),
        title: 'Build a CLI tool',
        steps: [
          { _id: oid(), title: 'Set up the project with clap', completed: true, completedAt: daysAgo(20), links: [] },
          { _id: oid(), title: 'Add subcommands', completed: true, completedAt: daysAgo(15), links: [] },
          { _id: oid(), title: 'Read config from disk', completed: false, links: [] },
          { _id: oid(), title: 'Publish to crates.io', completed: false, links: [] },
        ],
      },
      {
        _id: oid(),
        title: 'Async with tokio',
        steps: [
          { _id: oid(), title: 'Read tokio tutorial', completed: false, links: [{ url: 'https://tokio.rs/tokio/tutorial', label: 'Tokio tutorial' }] },
          { _id: oid(), title: 'Build a small chat server', completed: false, links: [] },
          { _id: oid(), title: 'Add structured logging with tracing', completed: false, links: [] },
        ],
      },
      {
        _id: oid(),
        title: 'Contribute to a Rust OSS project',
        steps: [
          { _id: oid(), title: 'Pick a project from "good first issue"', completed: false, links: [] },
          { _id: oid(), title: 'Submit first PR', completed: false, links: [] },
          { _id: oid(), title: 'Get PR merged', completed: false, links: [] },
        ],
      },
    ],
  };

  const backend: RoadmapSeed = {
    _id: oid(),
    userId,
    title: 'Land a senior backend role',
    description:
      'Targeted prep cycle: refresh fundamentals, drill system design, run live interviews. Aiming for offer in ~6 weeks.',
    archived: false,
    milestones: [
      {
        _id: oid(),
        title: 'Refresh fundamentals',
        steps: [
          { _id: oid(), title: 'Data structures review', completed: true, completedAt: daysAgo(45), links: [] },
          { _id: oid(), title: 'Algorithms cheat sheet', completed: true, completedAt: daysAgo(42), links: [] },
          { _id: oid(), title: '50 LeetCode mediums', completed: true, completedAt: daysAgo(28), links: [] },
        ],
        completedAt: daysAgo(28),
      },
      {
        _id: oid(),
        title: 'System design prep',
        steps: [
          { _id: oid(), title: 'Designing Data-Intensive Apps notes', completed: true, completedAt: daysAgo(22), links: [{ url: 'https://dataintensive.net', label: 'DDIA' }] },
          { _id: oid(), title: 'Mock with two peers', completed: true, completedAt: daysAgo(18), links: [] },
          { _id: oid(), title: 'Write 5 case studies', completed: true, completedAt: daysAgo(12), links: [] },
        ],
        completedAt: daysAgo(12),
      },
      {
        _id: oid(),
        title: 'Live interviews',
        steps: [
          { _id: oid(), title: 'Phone screens (target 4)', completed: true, completedAt: daysAgo(8), links: [] },
          { _id: oid(), title: 'Technical screens (target 3)', completed: true, completedAt: daysAgo(5), links: [] },
          { _id: oid(), title: 'Onsite loops (target 2)', completed: true, completedAt: daysAgo(2), links: [] },
          { _id: oid(), title: 'Negotiation prep', completed: false, links: [] },
          { _id: oid(), title: 'Accept and counter-sign', completed: false, links: [] },
        ],
      },
    ],
  };

  const pathforge: RoadmapSeed = {
    _id: oid(),
    userId,
    title: 'Ship Pathforge v0',
    description: 'Walking-skeleton release — auth, dashboard, profile, logout. Shipped 2026-05-17.',
    archived: true,
    milestones: [
      {
        _id: oid(),
        title: 'Repo scaffold',
        steps: [
          { _id: oid(), title: 'npm workspaces', completed: true, completedAt: daysAgo(60), links: [] },
          { _id: oid(), title: 'TS base config', completed: true, completedAt: daysAgo(60), links: [] },
        ],
        completedAt: daysAgo(60),
      },
      {
        _id: oid(),
        title: 'API skeleton',
        steps: [
          { _id: oid(), title: 'Fastify boot', completed: true, completedAt: daysAgo(55), links: [] },
          { _id: oid(), title: '/api/health', completed: true, completedAt: daysAgo(55), links: [] },
        ],
        completedAt: daysAgo(55),
      },
      {
        _id: oid(),
        title: 'Stub auth',
        steps: [
          { _id: oid(), title: 'Cookie session', completed: true, completedAt: daysAgo(50), links: [] },
          { _id: oid(), title: 'Dev users seed', completed: true, completedAt: daysAgo(50), links: [] },
          { _id: oid(), title: 'Login / logout / me', completed: true, completedAt: daysAgo(48), links: [] },
        ],
        completedAt: daysAgo(48),
      },
      {
        _id: oid(),
        title: 'Web skeleton',
        steps: [
          { _id: oid(), title: 'Vite + Tailwind + shadcn', completed: true, completedAt: daysAgo(46), links: [] },
          { _id: oid(), title: 'Login page', completed: true, completedAt: daysAgo(45), links: [] },
          { _id: oid(), title: 'Dashboard + Profile', completed: true, completedAt: daysAgo(44), links: [] },
        ],
        completedAt: daysAgo(44),
      },
      {
        _id: oid(),
        title: 'Docker compose',
        steps: [
          { _id: oid(), title: 'mongo + api + web', completed: true, completedAt: daysAgo(42), links: [] },
          { _id: oid(), title: 'One-command bring-up', completed: true, completedAt: daysAgo(42), links: [] },
        ],
        completedAt: daysAgo(42),
      },
    ],
  };

  return { rust, backend, pathforge };
}

function buildJobs(
  userId: Types.ObjectId,
  backendRoadmapId: Types.ObjectId
): JobSeed[] {
  return [
    {
      userId,
      company: 'Vercel',
      role: 'Senior Platform Engineer',
      jobUrl: 'https://vercel.com/careers',
      status: 'saved',
      tags: ['remote', 'dx'],
      notes: 'Interesting DX role; revisit after Rust milestones land.',
      contacts: [],
      rounds: [],
      links: {},
      archived: false,
    },
    {
      userId,
      company: 'Stripe',
      role: 'Staff Backend Engineer',
      jobUrl: 'https://stripe.com/jobs',
      status: 'applied',
      appliedAt: daysAgo(10),
      workMode: 'hybrid',
      location: 'New York, NY',
      tags: ['payments', 'go'],
      notes: 'Applied via referral. Waiting on recruiter screen.',
      contacts: [
        { name: 'Priya Shah', role: 'Recruiter', email: 'priya@stripe.com' },
      ],
      rounds: [],
      links: {},
      archived: false,
    },
    {
      userId,
      company: 'Linear',
      role: 'Senior Software Engineer',
      jobUrl: 'https://linear.app/careers',
      status: 'interviewing',
      appliedAt: daysAgo(21),
      workMode: 'remote',
      salaryRange: '$200k–$240k + equity',
      tags: ['remote', 'typescript'],
      notes:
        'Strongest fit so far. Linked to the backend-role roadmap — system design pillar applies directly.',
      contacts: [
        { name: 'Sara Ahmed', role: 'Recruiter', email: 'sara@linear.app' },
        { name: 'Marcus Lin', role: 'Hiring Manager', email: 'marcus@linear.app' },
      ],
      rounds: [
        {
          name: 'Recruiter screen',
          scheduledAt: daysAgo(18),
          durationMinutes: 30,
          interviewer: 'Sara Ahmed',
          outcome: 'passed',
          questions: ['Why Linear?', 'Comp expectations'],
          experience: 'Friendly call. Confirmed remote and salary band aligns.',
          prepNotes: '',
        },
        {
          name: 'System design',
          scheduledAt: daysAgo(7),
          durationMinutes: 60,
          interviewer: 'Marcus Lin',
          outcome: 'passed',
          questions: ['Design a real-time issue tracker sync layer'],
          experience:
            "Talked through CRDT vs operational transform. Marcus pushed on consistency edge cases — felt I held my own. Got the 'looking forward to the next round' line.",
          prepNotes: 'Reviewed DDIA Ch 5 and 9 the night before.',
        },
        {
          name: 'Final loop',
          scheduledAt: daysFromNow(4),
          durationMinutes: 180,
          outcome: 'pending',
          questions: [],
          experience: '',
          prepNotes: 'Two coding rounds + values interview. Refresh tree traversals.',
        },
      ],
      links: { roadmapId: backendRoadmapId },
      archived: false,
    },
    {
      userId,
      company: 'Anthropic',
      role: 'Backend Engineer',
      jobUrl: 'https://anthropic.com/careers',
      status: 'offer',
      appliedAt: daysAgo(30),
      workMode: 'onsite',
      location: 'San Francisco, CA',
      salaryRange: '$220k–$260k + equity',
      offerAmount: '$245k base + 0.04% equity',
      tags: ['ai', 'python'],
      notes:
        'Offer in hand. Decision window closes Friday. Mission alignment is the strongest pull.',
      contacts: [
        { name: 'Jasper Wu', role: 'Recruiter', email: 'jasper@anthropic.com' },
        { name: 'Elena Garcia', role: 'Hiring Manager' },
      ],
      rounds: [
        { name: 'Recruiter screen', scheduledAt: daysAgo(28), outcome: 'passed', questions: [], experience: '' },
        { name: 'Technical screen', scheduledAt: daysAgo(22), outcome: 'passed', questions: ['Distributed batch processing question'], experience: 'Tight on time but got to a working solution.' },
        { name: 'Onsite — coding', scheduledAt: daysAgo(12), outcome: 'passed', questions: [], experience: '' },
        { name: 'Onsite — system design', scheduledAt: daysAgo(12), outcome: 'passed', questions: ['Design a model-serving gateway'], experience: 'Best interview I have ever done.' },
      ],
      links: {},
      archived: false,
    },
    {
      userId,
      company: 'Figma',
      role: 'Staff Engineer',
      jobUrl: 'https://figma.com/careers',
      status: 'rejected',
      appliedAt: daysAgo(45),
      workMode: 'hybrid',
      tags: ['canvas', 'webgl'],
      notes:
        "Rejected after onsite. Feedback (paraphrased from recruiter call): 'great fundamentals, lighter on graphics-specific experience than the bar for this role.' Useful signal — Staff at Figma means deep canvas/rendering background, not generalist senior.",
      contacts: [
        { name: 'Olivia Reed', role: 'Recruiter', email: 'olivia@figma.com' },
      ],
      rounds: [
        { name: 'Technical screen', scheduledAt: daysAgo(38), outcome: 'passed', questions: [], experience: '' },
        { name: 'Onsite', scheduledAt: daysAgo(25), outcome: 'failed', questions: ['Implement a canvas hit-test'], experience: 'Stalled on the hit-test optimization. Knew enough to brute-force, not enough to spatially partition under pressure.' },
      ],
      links: {},
      archived: false,
    },
  ];
}

export function getDemoFixtures(userId: Types.ObjectId): {
  roadmaps: RoadmapSeed[];
  jobs: JobSeed[];
} {
  const { rust, backend, pathforge } = buildRoadmaps(userId);
  const jobs = buildJobs(userId, backend._id);
  return { roadmaps: [rust, backend, pathforge], jobs };
}
```

- [ ] **Step 4: Run the test, expect pass**

Run: `npm -w @pathforge/api run test -- seed-demo`
Expected: PASS — 7 assertions across 1 file.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/seedDemo.ts apps/api/test/seed-demo.test.ts
git commit -m "feat(api): demo fixture builder for showcase roadmaps and jobs"
```

---

## Task 6: Demo reset function (`resetDemoData`)

**Files:**
- Modify: `apps/api/src/seedDemo.ts`

- [ ] **Step 1: Add `resetDemoData` to `seedDemo.ts`**

Append to `apps/api/src/seedDemo.ts`:

```ts
import { RoadmapModel } from './models/Roadmap.js';
import { JobApplicationModel } from './models/JobApplication.js';

export async function resetDemoData(userId: Types.ObjectId): Promise<void> {
  await RoadmapModel.deleteMany({ userId });
  await JobApplicationModel.deleteMany({ userId });
  const { roadmaps, jobs } = getDemoFixtures(userId);
  await RoadmapModel.insertMany(roadmaps);
  await JobApplicationModel.insertMany(jobs);
}
```

Add the two imports at the top of the file (next to `import { Types } from 'mongoose'`). No transactions, no try/catch in this layer — the caller handles failures.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit -p apps/api/tsconfig.json`
Expected: no errors. (No new test — exercising this needs a real DB; manual checklist in Task 15 covers it.)

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/seedDemo.ts
git commit -m "feat(api): resetDemoData wipes and reseeds demo collections"
```

---

## Task 7: Call `resetDemoData` in the login handler

**Files:**
- Modify: `apps/api/src/routes/auth.ts:20-38`

- [ ] **Step 1: Insert the demo-reset block**

Edit `apps/api/src/routes/auth.ts`. Add an import at the top:

```ts
import { resetDemoData } from '../seedDemo.js';
```

Then update the `POST /api/auth/login` handler to call `resetDemoData` between `findById` and `setCookie`:

```ts
app.post('/api/auth/login', async (request, reply) => {
  const parsed = LoginRequestSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send({ error: 'Invalid body' });
  }
  const user = await UserModel.findById(parsed.data.userId).lean();
  if (!user) {
    return reply.code(400).send({ error: 'Unknown user' });
  }
  if (user.isDemoUser) {
    try {
      await resetDemoData(user._id);
    } catch (err) {
      request.log.error(
        { err, userId: String(user._id) },
        'demo-reset-failed'
      );
      // fail-open: continue with login so the demo user isn't locked out
    }
  }
  reply.setCookie(SESSION_COOKIE, String(user._id), {
    signed: true,
    httpOnly: true,
    sameSite: 'lax',
    secure: app.config.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
  return { ok: true };
});
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit -p apps/api/tsconfig.json`
Expected: no errors. `user._id` from a `.lean()` doc is `Types.ObjectId`, which `resetDemoData` accepts.

- [ ] **Step 3: Run the full api test suite to ensure nothing regressed**

Run: `npm -w @pathforge/api run test`
Expected: all tests pass, including the new `seed-demo.test.ts`.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/routes/auth.ts
git commit -m "feat(api): reset demo data on demo-user login"
```

---

## Task 8: Tour step config (`tourSteps.ts`)

**Files:**
- Create: `apps/web/src/components/tour/tourSteps.ts`

- [ ] **Step 1: Create the file**

Create `apps/web/src/components/tour/tourSteps.ts`:

```ts
export type TourStepGroup = 'Roadmaps' | 'Jobs';

export type TourStep = {
  id: string;
  group: TourStepGroup;
  title: string;
  body: string;
  cta?: { label: string; to: string };
};

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'roadmaps-browse',
    group: 'Roadmaps',
    title: 'Browse your roadmaps',
    body: 'Three goals, different states. Click into one.',
    cta: { label: 'Open Roadmaps', to: '/roadmaps' },
  },
  {
    id: 'roadmaps-open-active',
    group: 'Roadmaps',
    title: 'Open the in-progress one',
    body: 'Watch how milestones stack into steps.',
    cta: { label: 'Open "Land a senior backend role"', to: '/roadmaps' },
  },
  {
    id: 'roadmaps-toggle-step',
    group: 'Roadmaps',
    title: 'Toggle a step complete',
    body: 'Click the checkbox on any step. Progress updates everywhere.',
  },
  {
    id: 'roadmaps-reorder',
    group: 'Roadmaps',
    title: 'Reorder milestones',
    body: 'Drag the handle on the left of any milestone. The order persists.',
  },
  {
    id: 'roadmaps-import',
    group: 'Roadmaps',
    title: 'Import from an LLM',
    body: 'The fastest way to build one — paste a prompt, paste JSON, done.',
    cta: { label: 'Try LLM import', to: '/roadmaps' },
  },
  {
    id: 'jobs-browse',
    group: 'Jobs',
    title: 'Track your applications',
    body: 'Five jobs across the funnel. Counts on the Active / Archive toggle.',
    cta: { label: 'Open Jobs', to: '/jobs' },
  },
  {
    id: 'jobs-open-interview',
    group: 'Jobs',
    title: 'Open the active interview',
    body: 'The Linear job — notice it is linked to a roadmap.',
    cta: { label: 'Open Linear application', to: '/jobs' },
  },
  {
    id: 'jobs-add-round',
    group: 'Jobs',
    title: 'Add an interview round',
    body: 'The round dialog handles dates, outcomes, feedback, prep notes.',
  },
  {
    id: 'jobs-export-report',
    group: 'Jobs',
    title: 'Export an interview report',
    body: 'Generates an LLM prompt for a candid post-interview write-up. From the job actions menu.',
  },
];
```

Note: the `roadmaps-open-active`, `jobs-open-interview`, and `jobs-export-report` CTAs target `/roadmaps` and `/jobs` rather than deep links — the demo data has fresh `_id`s on every login, so deep links would need a runtime lookup. Keeping them at the list level keeps the tour resilient to data resets.

- [ ] **Step 2: Type-check**

Run: `npm -w @pathforge/web run typecheck` (or `npx tsc --noEmit -p apps/web/tsconfig.json`)
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/tour/tourSteps.ts
git commit -m "feat(web): tour step config for demo onboarding"
```

---

## Task 9: `TourProvider` context

**Files:**
- Create: `apps/web/src/components/tour/TourProvider.tsx`

- [ ] **Step 1: Create the provider**

Create `apps/web/src/components/tour/TourProvider.tsx`:

```tsx
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useMe } from '@/hooks/useAuth';

type TourContextValue = {
  isDemoUser: boolean;
  open: boolean;
  completedStepIds: Set<string>;
  currentStepId: string | null;
  openPanel: () => void;
  closePanel: () => void;
  restart: () => void;
  markComplete: (id: string) => void;
};

const TourContext = createContext<TourContextValue | null>(null);

export function TourProvider({ children }: { children: React.ReactNode }) {
  const { data: me } = useMe();
  const isDemoUser = me?.isDemoUser === true;

  const [open, setOpen] = useState(false);
  const [completedStepIds, setCompletedStepIds] = useState<Set<string>>(() => new Set());
  const [currentStepId, setCurrentStepId] = useState<string | null>(null);
  const autoOpenedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!isDemoUser || !me) return;
    if (autoOpenedFor.current === me._id) return;
    autoOpenedFor.current = me._id;
    setOpen(true);
  }, [isDemoUser, me]);

  const openPanel = useCallback(() => setOpen(true), []);
  const closePanel = useCallback(() => setOpen(false), []);
  const restart = useCallback(() => {
    setCompletedStepIds(new Set());
    setCurrentStepId(null);
    setOpen(true);
  }, []);
  const markComplete = useCallback((id: string) => {
    setCompletedStepIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    setCurrentStepId(id);
  }, []);

  const value: TourContextValue = {
    isDemoUser,
    open,
    completedStepIds,
    currentStepId,
    openPanel,
    closePanel,
    restart,
    markComplete,
  };

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
}

export function useTour(): TourContextValue {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error('useTour must be used within <TourProvider>');
  return ctx;
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit -p apps/web/tsconfig.json`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/tour/TourProvider.tsx
git commit -m "feat(web): TourProvider context with auto-open for demo user"
```

---

## Task 10: `TourPanel` component

**Files:**
- Create: `apps/web/src/components/tour/TourPanel.tsx`

- [ ] **Step 1: Create the panel**

Create `apps/web/src/components/tour/TourPanel.tsx`:

```tsx
import { Link } from 'react-router-dom';
import { Check, Circle, RotateCcw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTour } from './TourProvider';
import { TOUR_STEPS, type TourStep } from './tourSteps';

export function TourPanel() {
  const { isDemoUser, open, completedStepIds, openPanel, closePanel, restart, markComplete } = useTour();

  if (!isDemoUser) return null;

  if (!open) {
    return (
      <button
        type="button"
        onClick={openPanel}
        className="fixed bottom-6 right-6 z-50 inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-lg hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
      >
        Resume tour ▸
      </button>
    );
  }

  const grouped: Record<string, TourStep[]> = {};
  for (const step of TOUR_STEPS) {
    if (!grouped[step.group]) grouped[step.group] = [];
    grouped[step.group].push(step);
  }
  const completedCount = TOUR_STEPS.filter((s) => completedStepIds.has(s.id)).length;

  return (
    <aside className="fixed right-0 top-16 z-40 flex h-[calc(100vh-4rem)] w-80 flex-col border-l border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-950">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
        <div>
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Pathfinder tour</div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {completedCount} / {TOUR_STEPS.length}
          </div>
        </div>
        <button
          type="button"
          onClick={closePanel}
          className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          aria-label="Close tour"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {(['Roadmaps', 'Jobs'] as const).map((group) => (
          <section key={group} className="mb-6 last:mb-0">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {group}
            </h3>
            <ol className="space-y-3">
              {(grouped[group] ?? []).map((step) => {
                const done = completedStepIds.has(step.id);
                return (
                  <li key={step.id} className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => markComplete(step.id)}
                      className="mt-0.5 shrink-0 text-slate-400 hover:text-emerald-600"
                      aria-label={done ? 'Mark step incomplete' : 'Mark step complete'}
                    >
                      {done ? (
                        <Check className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <Circle className="h-4 w-4" />
                      )}
                    </button>
                    <div className="min-w-0">
                      <div className={done ? 'text-sm font-medium text-slate-400 line-through dark:text-slate-500' : 'text-sm font-medium text-slate-900 dark:text-slate-100'}>
                        {step.title}
                      </div>
                      <div className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">{step.body}</div>
                      {step.cta && (
                        <Link
                          to={step.cta.to}
                          onClick={() => markComplete(step.id)}
                          className="mt-1 inline-block text-xs font-medium text-sky-600 hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-300"
                        >
                          {step.cta.label} →
                        </Link>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-slate-200 px-4 py-3 dark:border-slate-800">
        <Button type="button" variant="ghost" size="sm" onClick={restart}>
          <RotateCcw className="mr-1 h-3 w-3" /> Restart
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={closePanel}>
          Close
        </Button>
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit -p apps/web/tsconfig.json`
Expected: no errors. The `lucide-react` icons used here (`Check`, `Circle`, `RotateCcw`, `X`) are already present in the codebase (see existing job/roadmap components).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/tour/TourPanel.tsx
git commit -m "feat(web): TourPanel side dock with grouped steps and resume pill"
```

---

## Task 11: `DemoBadge` component

**Files:**
- Create: `apps/web/src/components/tour/DemoBadge.tsx`

- [ ] **Step 1: Create the badge**

Create `apps/web/src/components/tour/DemoBadge.tsx`:

```tsx
export function DemoBadge() {
  return (
    <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
      Demo
    </span>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit -p apps/web/tsconfig.json`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/tour/DemoBadge.tsx
git commit -m "feat(web): DemoBadge pill for demo-user navbar identity"
```

---

## Task 12: Wrap protected routes with `TourProvider` and mount `TourPanel`

**Files:**
- Modify: `apps/web/src/App.tsx`

This runs *before* the Navbar change so `useTour()` always has a provider at runtime once Navbar starts depending on it.

- [ ] **Step 1: Wrap and mount**

Edit `apps/web/src/App.tsx`. Replace the entire file with:

```tsx
import { Route, Routes } from 'react-router-dom';
import { Navbar } from '@/components/Navbar';
import { RequireAuth } from '@/components/RequireAuth';
import { TourProvider } from '@/components/tour/TourProvider';
import { TourPanel } from '@/components/tour/TourPanel';
import Dashboard from '@/pages/Dashboard';
import Login from '@/pages/Login';
import Profile from '@/pages/Profile';
import RoadmapsListPage from '@/pages/RoadmapsListPage';
import RoadmapDetailPage from '@/pages/RoadmapDetailPage';
import JobsListPage from '@/pages/JobsListPage';
import JobDetailPage from '@/pages/JobDetailPage';

function Protected({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <TourProvider>
        <Navbar />
        {children}
        <TourPanel />
      </TourProvider>
    </RequireAuth>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Protected><Dashboard /></Protected>} />
      <Route path="/profile" element={<Protected><Profile /></Protected>} />
      <Route path="/roadmaps" element={<Protected><RoadmapsListPage /></Protected>} />
      <Route path="/roadmaps/archived" element={<Protected><RoadmapsListPage archived /></Protected>} />
      <Route path="/roadmaps/:id" element={<Protected><RoadmapDetailPage /></Protected>} />
      <Route path="/jobs" element={<Protected><JobsListPage /></Protected>} />
      <Route path="/jobs/archived" element={<Protected><JobsListPage archived /></Protected>} />
      <Route path="/jobs/:id" element={<Protected><JobDetailPage /></Protected>} />
      <Route path="*" element={<Protected><Dashboard /></Protected>} />
    </Routes>
  );
}
```

At this point the Navbar still does not call `useTour()`, so the new `TourProvider` is unused by Navbar but already in place. `TourPanel` mounts and short-circuits to `null` because `me.isDemoUser !== true` for Ada/Alan/Grace and there is no demo user logged in yet.

- [ ] **Step 2: Build the web app**

Run: `npm -w @pathforge/web run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/App.tsx
git commit -m "feat(web): wrap protected routes with TourProvider, mount TourPanel"
```

---

## Task 13: Wire `DemoBadge` and "Restart tour" into the navbar

**Files:**
- Modify: `apps/web/src/components/Navbar.tsx`

- [ ] **Step 1: Add imports and conditional UI**

Edit `apps/web/src/components/Navbar.tsx`. Replace the entire file with:

```tsx
import { Link, useNavigate } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useMe, useLogout } from '@/hooks/useAuth';
import { DemoBadge } from '@/components/tour/DemoBadge';
import { useTour } from '@/components/tour/TourProvider';

export function Navbar() {
  const navigate = useNavigate();
  const { data: me } = useMe();
  const logout = useLogout();
  const { isDemoUser, restart } = useTour();

  if (!me) return null;

  const initials = me.name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 dark:border-slate-800 bg-background/85 backdrop-blur">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-8">
          <Link
            to="/"
            className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100"
          >
            Pathforge
          </Link>
          <nav className="flex items-center gap-5 text-sm text-slate-600 dark:text-slate-400">
            <Link to="/roadmaps" className="hover:text-slate-900 dark:hover:text-slate-100 transition-colors">
              Roadmaps
            </Link>
            <Link to="/jobs" className="hover:text-slate-900 dark:hover:text-slate-100 transition-colors">
              Jobs
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-2 outline-none">
              <Avatar className="h-8 w-8">
                {me.avatarUrl && <AvatarImage src={me.avatarUrl} alt={me.name} />}
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <span className="text-sm text-slate-700 dark:text-slate-300">{me.name}</span>
              {isDemoUser && <DemoBadge />}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{me.email}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {isDemoUser && (
                <>
                  <DropdownMenuItem onSelect={() => restart()}>
                    Restart tour
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem onSelect={() => navigate('/profile')}>
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={async () => {
                  await logout.mutateAsync();
                  navigate('/login', { replace: true });
                }}
              >
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit -p apps/web/tsconfig.json`
Expected: no errors. Task 12 already wrapped protected routes in `<TourProvider>`, so `useTour()` resolves at runtime too.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/Navbar.tsx
git commit -m "feat(web): demo badge + restart-tour menu item in navbar"
```

---

## Task 14: Update PROJECT.md

**Files:**
- Modify: `docs/PROJECT.md`

- [ ] **Step 1: Add the Auth Strategy note**

Edit `docs/PROJECT.md`. In the "Phase 2 — Google OAuth (later)" subsection, add a bullet noting the demo-reset hook:

```markdown
- Note: the demo-reset hook in the login handler (`if user.isDemoUser → resetDemoData`) is part of the login route. When Phase 2 replaces `POST /api/auth/login`, port that hook to the OAuth callback or drop it if demo users won't exist in production.
```

- [ ] **Step 2: Add the Changelog entry**

At the end of the Changelog section, append:

```markdown
- *2026-05-21* — Demo user + onboarding tour: added `isDemoUser` flag on the User schema, a fourth seeded dev user `Pathfinder Demo` whose roadmaps + jobs are wiped and reseeded from a canonical showcase fixture (3 roadmaps, 5 jobs spanning the application funnel) on every login, and a side-panel `TourPanel` that auto-opens for the demo user and walks through 5 Roadmaps steps then 4 Jobs steps. Tour state is in-memory only.
```

- [ ] **Step 3: Commit**

```bash
git add docs/PROJECT.md
git commit -m "docs: log demo-user + tour milestone in PROJECT.md"
```

---

## Task 15: Manual verification

This task has no automated tests — it walks the acceptance criteria from the spec.

- [ ] **Step 1: Bring up a fresh stack**

Run: `docker compose down -v && docker compose up`
Expected: api seeds 4 dev users on boot, web serves at `http://localhost:5173`.

- [ ] **Step 2: Verify the login dropdown**

Open `http://localhost:5173/login`.
Expected: dropdown lists 4 users including "Pathfinder Demo".

- [ ] **Step 3: Log in as the demo user**

Pick "Pathfinder Demo" → Continue.
Expected:
- Land on `/`.
- Tour panel is auto-open on the right side of the viewport.
- Panel header shows "Pathfinder tour" and "0 / 9".
- Two groups visible: Roadmaps (5 steps), Jobs (4 steps).
- "Demo" pill next to the user's name in the navbar.
- Avatar dropdown contains a "Restart tour" item above "Profile".

- [ ] **Step 4: Verify the seeded data**

Navigate to `/roadmaps`.
Expected: 3 roadmaps visible — "Learn Rust for systems work", "Land a senior backend role", "Ship Pathforge v0" (the last one under the Archive view).

Navigate to `/jobs`.
Expected: 5 applications visible — Vercel (saved), Stripe (applied), Linear (interviewing), Anthropic (offer), Figma (rejected).

- [ ] **Step 5: Verify dismissal and resume**

Click the X on the tour panel.
Expected: panel disappears; a "Resume tour ▸" pill appears in the bottom-right.

Click the pill.
Expected: panel reopens with whatever step completion state it had.

- [ ] **Step 6: Verify restart**

Click a step's circle to mark complete (counter increments to 1/9). Open the avatar dropdown → "Restart tour".
Expected: completed count resets to 0/9, panel reopens at step 1, and `currentStepId` clears.

- [ ] **Step 7: Verify the reset cycle**

Delete one of the demo user's roadmaps via the UI. Log out → log back in as Pathfinder Demo.
Expected: deleted roadmap is back; counts are 3 roadmaps and 5 jobs.

- [ ] **Step 8: Verify isolation for non-demo users**

Log out → log in as Ada Lovelace.
Expected:
- No tour panel.
- No "Resume tour" pill.
- No "Demo" badge in the navbar.
- No "Restart tour" item in the avatar dropdown.
- Ada's roadmaps and jobs are untouched (empty unless she had her own).

- [ ] **Step 9: Commit notes (optional)**

If anything in the manual run surfaced a bug, fix it and amend the PR description with the manual checklist outcomes. No commit is needed if all steps pass.
