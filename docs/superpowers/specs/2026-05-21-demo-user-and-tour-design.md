# Demo User and Onboarding Tour — Design

*2026-05-21*

## Purpose

Add a dedicated demo account ("Pathfinder Demo") that ships with a curated showcase set of roadmaps and job applications, and a side-panel checklist tour that auto-opens whenever that account logs in. Used for live demos and as a learning surface for new users.

The dashboard widget redesign is **out of scope** here; the tour deliberately starts on `/roadmaps` and never references widgets that don't exist yet.

## Goals

- Logging in as `demo@pathforge.dev` always lands the user in a pristine, populated app — every login wipes their data and re-seeds the canonical fixture.
- A side-panel tour auto-opens on login, walks the viewer through Roadmaps (5 steps) then Jobs (4 steps), and stays dismissable + replayable.
- Non-demo users (Ada, Alan, Grace, and any future real users) see zero tour-related UI and have no data touched.
- Zero changes to the existing auth shape, query keys, or routing contracts (load-bearing rules from `CLAUDE.md`).

## Non-Goals

- Dashboard homepage widgets — deferred.
- Onboarding for real first-time users post-OAuth — deferred. The shape here is a *demoer's* tour, not a generic empty-state coach.
- Persistent dismiss across sessions, manual "Reset demo data" button, frontend test infrastructure, telemetry. All can be added later without changing the data model.

## Architecture

```
                       login( userId )
                              │
              POST /api/auth/login
                              │
                              ▼
                   ┌─────────────────────┐
                   │  lookup user        │
                   └─────────┬───────────┘
                             │
                  user.isDemoUser ?
                             │
                  ┌──────────┴──────────┐
                  │ yes                 │ no
                  ▼                     ▼
        await resetDemoData(id)   (skip)
                  │                     │
                  └──────────┬──────────┘
                             ▼
                   set session cookie
                             │
                             ▼
                       redirect /
                             │
                             ▼
           ┌─────────── frontend ───────────┐
           │  useMe() → me                  │
           │  me.isDemoUser ? mount tour    │
           └────────────────────────────────┘
```

The demo-reset is a synchronous side effect of becoming the demo user. The frontend treats `isDemoUser` as just another field on `/me` and conditionally mounts tour UI based on it.

## Load-Bearing Rules Respected

- Every fixture document carries `userId: demoUser._id`. Both `RoadmapModel` and `JobApplicationModel` queries continue to filter by `userId`.
- `isDemoUser` lives in the shared Zod schema; both API and web import from `@pathforge/shared`.
- Auth shape unchanged: `/login`, `/logout`, `/me`, the middleware, the `<RequireAuth>` wrapper, the `['auth', 'me']` query key. Phase 2 OAuth swap remains a swap of `POST /api/auth/login` only — the demo-reset hook lives inside that handler and moves with it.
- `axios` `withCredentials: true` unaffected.

---

## Data Model

### Shared schema change

`packages/shared/src/user.ts` — add `isDemoUser` to `UserSchema`:

```ts
isDemoUser: z.boolean().optional()
```

Optional field, defaults to `false` at the model level. Existing users (Ada, Alan, Grace, plus any real users) are unaffected. Inferred TS type updates automatically on both apps.

### Mongoose model

`apps/api/src/models/User.ts` — add:

```ts
isDemoUser: { type: Boolean, default: false }
```

Not indexed. Only ever read from the user document attached to `req.user`; never queried by.

### Seed

`apps/api/src/seed.ts` — append a fourth user to `DEV_USERS`:

```ts
{
  email: 'demo@pathforge.dev',
  name: 'Pathfinder Demo',
  avatarUrl: 'https://api.dicebear.com/9.x/initials/svg?seed=Pathfinder%20Demo',
  isDemoUser: true,
}
```

Demo user appears in `GET /api/auth/dev-users` alongside the others. The dropdown on `/login` shows all four; nothing in that endpoint changes.

### No new collections

Fixture roadmaps and job applications live in the existing `roadmaps` and `jobApplications` collections, scoped to the demo user's `_id` like any other user's data.

---

## API

### New module: `apps/api/src/seedDemo.ts`

Exports two things:

```ts
function getDemoFixtures(userId: Types.ObjectId): {
  roadmaps: Array<RoadmapDocSeed>;
  jobs: Array<JobApplicationDocSeed>;
};

async function resetDemoData(userId: Types.ObjectId): Promise<void>;
```

`resetDemoData` implementation:

1. `await RoadmapModel.deleteMany({ userId })`
2. `await JobApplicationModel.deleteMany({ userId })`
3. `const { roadmaps, jobs } = getDemoFixtures(userId)`
4. `await RoadmapModel.insertMany(roadmaps)`
5. `await JobApplicationModel.insertMany(jobs)`

Sequential, no transactions. Failure mid-flight leaves a partial state that the next login wipes and retries — acceptable for demo data.

Fixtures are built in TypeScript (not JSON) so a Zod/Mongoose schema change forces a compile-time error.

### Login handler change

`apps/api/src/routes/auth.ts`, `POST /api/auth/login` — insert a block between the `findById` and the `setCookie`. The current handler ends:

```ts
const user = await UserModel.findById(parsed.data.userId).lean();
if (!user) {
  return reply.code(400).send({ error: 'Unknown user' });
}
// (new block goes here)
reply.setCookie(SESSION_COOKIE, String(user._id), { ... });
return { ok: true };
```

The new block:

```ts
if (user.isDemoUser) {
  try {
    await resetDemoData(user._id);
  } catch (err) {
    request.log.error({ err, userId: String(user._id) }, 'demo-reset-failed');
    // fail-open: continue with login so the demo isn't locked out
  }
}
```

`user` is `.lean()`-ed and therefore plain JS; `user.isDemoUser` is `boolean | undefined`, and the truthy check handles both. `user._id` is a `Types.ObjectId`, which is what `resetDemoData` accepts.

No other route is touched. `/me`, `/logout`, the middleware, and all `/api/roadmaps` and `/api/jobs` routes are unchanged.

### Error handling

- `resetDemoData` failure: logged via Fastify pino, login proceeds. User lands on a possibly-stale dashboard; next login retries the reset.
- Schema validation failures on the demo fixture itself (caught by Mongoose) propagate to the same try/catch — same fail-open behavior.

---

## Fixture Content — The Showcase Set

### 3 roadmaps

1. **"Learn Rust for systems work"** — `status: 'active'`, ~30% complete.
   - 4 milestones:
     - *Read The Book Ch 1–10* — 4 steps, all complete.
     - *Build a CLI tool* — 4 steps, 2 complete.
     - *Async with tokio* — 3 steps, 0 complete.
     - *Contribute to a Rust OSS project* — 3 steps, 0 complete.
   - Description: short paragraph about wanting to write production systems tools.

2. **"Land a senior backend role"** — `status: 'active'`, ~80% complete. Linked from one job (Linear) via `links.roadmapId`.
   - 3 milestones:
     - *Refresh fundamentals* — all steps complete.
     - *System design prep* — all steps complete.
     - *Live interviews* — 5 steps, 3 complete.

3. **"Ship Pathforge v0"** — `status: 'archived'`, 100% complete.
   - 5 milestones, all done. Demonstrates the archived/done state.

### 5 job applications

| # | Company | Role | Status | Linked roadmap | Rounds | Contacts | Notes | Other |
|---|---|---|---|---|---|---|---|---|
| 1 | Vercel | Senior Platform Engineer | `saved` | — | 0 | 0 | "interesting DX role; revisit after Rust milestones" | `jobUrl` set |
| 2 | Stripe | Staff Backend Engineer | `applied` | — | 0 | 1 (recruiter, email) | brief | `appliedAt` ~10 days ago, `jobUrl` set |
| 3 | Linear | Senior Software Engineer | `interview` | "Land a senior backend role" | 3 (recruiter screen done/passed, system design done/passed, final loop scheduled future) | 2 (recruiter + hiring manager, both with email) | feedback notes per round | salary range filled, tags `["remote", "typescript"]` |
| 4 | Anthropic | Backend Engineer | `offer` | — | 4 (all done) | 2 | offer details — TC, start date target | tags `["onsite"]` |
| 5 | Figma | Staff Engineer | `rejected` | — | 2 (both done) | 1 | post-mortem feedback (the use-case the export-report feature targets) | — |

**Variety covered:** every job status except `withdrawn`; active + archived roadmaps; rounds with all three outcomes; one roadmap↔job link; tags; salary range; contacts both with and without email; one job intentionally sparse (Vercel) for contrast.

---

## Frontend

### New folder: `apps/web/src/components/tour/`

#### `TourProvider.tsx`

React context. State (in-memory only, no localStorage):

- `open: boolean`
- `completedStepIds: Set<string>`
- `currentStepId: string | null`

Actions:

- `openPanel()`
- `closePanel()`
- `restart()` — clears `completedStepIds`, sets `open: true`, anchors `currentStepId` to the first step.
- `markComplete(id: string)`

Auto-open: on mount, when `me.isDemoUser === true` and `open` is still at its initial value, call `openPanel()` once. Dismiss is sticky for the rest of the session (no re-open until `restart()` or page reload).

Non-demo users: the provider still wraps the tree but renders no UI; `open` stays false and all actions are no-ops in terms of visible effect.

#### `tourSteps.ts`

Typed config — single source of truth:

```ts
type TourStep = {
  id: string;
  group: 'Roadmaps' | 'Jobs';
  title: string;
  body: string;
  cta?: { label: string; to: string };
};

export const TOUR_STEPS: TourStep[] = [ ... ];
```

#### `TourPanel.tsx`

Fixed-position dock anchored to the right side of the viewport. ~320px wide, full viewport height minus navbar. Internal scroll. Contents:

- Header: "Pathfinder tour" + step counter (e.g. *3 / 9*) + close (X).
- Grouped sections ("Roadmaps", "Jobs"). Each step is a row with:
  - circle/check (toggleable manually by clicking).
  - title (bold).
  - body (one or two sentences).
  - optional CTA link — clicking navigates via react-router and calls `markComplete(id)`.
- Footer: "Restart tour" link, "Close" link.

Closed state: a small floating pill "Resume tour ▸" at bottom-right that re-opens on click. Only rendered when `me.isDemoUser` and `open === false`.

#### `DemoBadge.tsx`

Tiny pill ("Demo Mode") placed next to the user's name in the navbar. Only rendered when `me.isDemoUser`.

### Tour content (9 steps)

**Roadmaps**

1. **Browse your roadmaps** — "Three goals, different states. Click in to one." → `/roadmaps`.
2. **Open the in-progress one** — "Watch how milestones stack into steps." → `/roadmaps/:landRoleId`.
3. **Toggle a step complete** — "Click the checkbox. Progress updates everywhere." (no CTA — in-place action.)
4. **Reorder milestones** — "Drag the handle on the left. The order persists." (no CTA.)
5. **Import from an LLM** — "The fastest way to build a roadmap — paste a prompt, paste JSON, done." → `/roadmaps`.

**Jobs**

6. **Track applications** — "Five jobs across the funnel. Counts on the toggle." → `/jobs`.
7. **Open the active interview** — "Notice it's linked to a roadmap." → `/jobs/:linearId`.
8. **Add a round** — "Round dialog handles dates, outcomes, feedback." (no CTA.)
9. **Export an interview report** — "Generates an LLM prompt for a candid post-interview write-up." (no CTA — from the job actions menu.)

The `:landRoleId` and `:linearId` placeholders are resolved at render time by querying the roadmaps and jobs lists by their known canonical title/company string and picking the first match. If the lookup fails (data drift), the CTA falls back to the index route (`/roadmaps`, `/jobs`).

### Navbar changes

`apps/web/src/components/Navbar.tsx`:

- If `me.isDemoUser`, render `<DemoBadge />` adjacent to the user name.
- In the avatar dropdown menu, insert a "Restart tour" item above "Profile". Only visible when `me.isDemoUser`. Clicking calls `restart()` from the tour context.

### App-level wiring

`apps/web/src/App.tsx`:

- Wrap the protected-routes subtree with `<TourProvider>`.
- Mount `<TourPanel />` once at the top of the protected-routes subtree so it overlays every protected page consistently. The panel and the "Resume tour" pill internally no-op when `me.isDemoUser !== true`.

### No new dependencies

No tour library (no Driver.js, no Shepherd, no Intro.js). The side-panel design uses existing shadcn/ui primitives (Card, Button) and Tailwind utilities.

---

## Testing

### API

Two tests added to the existing API test setup:

1. **Demo login resets and reseeds** — `POST /api/auth/login` with `userId` of the demo user. After the response:
   - `RoadmapModel.find({ userId: demoUser._id }).countDocuments() === 3`
   - `RoadmapModel.findOne({ userId, title: 'Land a senior backend role' })` exists.
   - `JobApplicationModel.find({ userId }).countDocuments() === 5`
   - `JobApplicationModel.findOne({ userId, company: 'Linear', status: 'interview' })` exists.
   - Log in a second time; counts still 3 and 5 (idempotency).

2. **Non-demo login does not touch data** — Log in as Ada, who has no roadmaps/jobs to start. Assert her collections remain empty. Then create a roadmap for Ada by direct DB insert, log her in again, and assert the roadmap survives.

### Frontend

No new frontend tests this milestone — the project's frontend test infrastructure is intentionally minimal and adding it for this feature is scope creep. Manual checklist documented in the PR description:

- Log in as Pathfinder Demo → tour panel auto-opens with 9 steps grouped by Roadmaps/Jobs.
- Dismiss tour → floating "Resume tour" pill appears.
- Click pill → panel reopens.
- "Restart tour" in avatar menu → completed steps clear, panel opens at step 1.
- Log in as Ada → no tour panel, no demo badge, no restart menu item, no resume pill.
- Log in as Pathfinder Demo, delete a roadmap, log out, log back in → roadmap is back; counts back to 3/5.

---

## Files added or changed

**Added**

- `apps/api/src/seedDemo.ts`
- `apps/web/src/components/tour/TourProvider.tsx`
- `apps/web/src/components/tour/TourPanel.tsx`
- `apps/web/src/components/tour/DemoBadge.tsx`
- `apps/web/src/components/tour/tourSteps.ts`

**Changed**

- `packages/shared/src/user.ts` — add `isDemoUser` to `UserSchema`.
- `apps/api/src/models/User.ts` — add `isDemoUser` to the Mongoose schema.
- `apps/api/src/seed.ts` — append the fourth (demo) user.
- `apps/api/src/routes/auth.ts` — call `resetDemoData` in the login handler if `user.isDemoUser`.
- `apps/web/src/components/Navbar.tsx` — demo badge + restart-tour menu item.
- `apps/web/src/App.tsx` — wrap with `TourProvider`, mount `TourPanel`.
- `docs/PROJECT.md` — Changelog entry; one-line note under Auth Strategy that the demo-reset hook in the login handler is `isDemoUser`-gated and moves with the login route in Phase 2.

## Acceptance Criteria

1. From a fresh `docker compose down -v && docker compose up`, the `/login` dropdown shows four users including "Pathfinder Demo".
2. Selecting Pathfinder Demo and clicking Continue lands the user on the dashboard with the tour panel auto-opened on the right side and 9 steps visible.
3. The user has exactly 3 roadmaps (visible on `/roadmaps`) and exactly 5 job applications (visible on `/jobs`).
4. Deleting a roadmap, logging out, and logging back in as Pathfinder Demo restores the deleted roadmap.
5. Logging in as Ada, Alan, or Grace shows no tour-related UI and no demo-only navbar affordances.
6. The two API tests pass.
