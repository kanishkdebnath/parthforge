# Handoff — Demo User + Onboarding Tour

*2026-05-21 — pause point for session switch*

This doc lets a fresh session pick up the demo-user + onboarding-tour feature without reading the entire prior transcript. Pair with the spec and plan.

## Companion docs

- **Spec:** [specs/2026-05-21-demo-user-and-tour-design.md](specs/2026-05-21-demo-user-and-tour-design.md) — the design rationale, data model, API + frontend architecture, acceptance criteria.
- **Plan:** [plans/2026-05-21-demo-user-and-tour.md](plans/2026-05-21-demo-user-and-tour.md) — the 15-task implementation plan, executed via subagent-driven development.
- **CLAUDE.md** at repo root — load-bearing architectural rules (`packages/shared` keystone, `userId` on every collection, auth shape stable across phases).

## Branch state

- **Branch:** `feat/demo-user-tour` (off `main`).
- **23 commits**, +824 / -12 lines across 16 files (delta against `main`).
- **Tests:** 28/28 vitest tests pass (`npm test` from repo root).
- **TypeScript:** clean on both `apps/api` and `apps/web` tsconfigs.
- **Build:** `npm -w @pathforge/web run build` succeeds.
- **Not yet merged.** Not yet PR'd.

### Commit chronology

```
c910e8d feat(shared): add isDemoUser to UserSchema
cb202d6 feat(api): add isDemoUser to user Mongoose schema
f9fe275 feat(api): expose isDemoUser on req.user
2493a19 feat(api): seed Pathfinder Demo dev user
0474c86 feat(api): demo fixture builder for showcase roadmaps and jobs
4f7ce29 polish(api): seed-demo type completeness and content cleanup
cdfb9d7 feat(api): resetDemoData wipes and reseeds demo collections
8d41ae9 feat(api): reset demo data on demo-user login
d9af398 feat(web): tour step config for demo onboarding
c60d116 polish(web): note demo-fixture coupling on tour step label
fd0b055 feat(web): TourProvider context with auto-open for demo user
b11273a fix(web): TourProvider.restart anchors currentStepId to first tour step
1c70858 feat(web): TourPanel side dock with grouped steps and resume pill
13687bb polish(web): TourPanel a11y + render perf cleanup
6e00474 feat(web): DemoBadge pill for demo-user navbar identity
72ba674 feat(web): wrap protected routes with TourProvider, mount TourPanel
658d936 feat(web): demo badge + restart-tour menu item in navbar
10c5771 docs: log demo-user + tour milestone in PROJECT.md
6c00ee4 fix(web): hoist TourProvider above Routes to keep dismiss sticky
f7bd64c fix(api): backfill demo user when seed runs against non-empty users
4657281 polish(web): float TourPanel as frosted card with section accents
5097382 feat(web): mark demo user with badge and separator in login dropdown
1b5e01e feat(web): floating tour callout with route-change auto-advance
```

## What was built

- A fourth seeded dev user **Pathfinder Demo** (`demo@pathforge.dev`) carrying `isDemoUser: true`.
- `isDemoUser` propagated through the shared Zod schema → Mongoose user schema → auth plugin → `/api/auth/me` response → `DevUser` dropdown payload.
- `apps/api/src/seedDemo.ts` — typed fixture builder (`getDemoFixtures`) returning 3 showcase roadmaps and 5 jobs, plus `resetDemoData(userId)` that wipes and re-inserts. Wired into the login handler with try/catch fail-open.
- Seed (`apps/api/src/seed.ts`) is idempotent for the demo user: it backfills the demo user even when the `users` collection already has Ada/Alan/Grace.
- A side-panel `TourPanel` (right-floating frosted card, section accent dots, restart/close, resume pill on dismiss) auto-opens for the demo user.
- A `TourCallout` floating arrow/bubble that anchors to specific UI elements (currently the Roadmaps and Jobs navbar links, plus the LLM-import button) for the current step.
- `TourProvider` hoisted to App root so dismiss/state survive route navigations.
- Route-change auto-advance: visiting `/roadmaps` or `/jobs` auto-marks the matching step complete.
- Demo user is visually distinguished in the login dropdown (separator + amber badge + amber tint on hover).
- `DemoBadge` pill in the navbar next to the demo user's name, and a "Restart tour" item in the avatar dropdown.

## What's NOT yet done

### Task 15 — manual verification (in progress)

User is mid-way through the manual checklist from the plan. They have:
- Brought up the stack with `docker compose up --build`.
- Confirmed the demo user appears in the dropdown (after the seed-backfill fix).
- Confirmed the tour panel auto-opens.
- Asked for the floating-card polish (delivered in `4657281`).
- Asked for a login-dropdown demo marker (delivered in `5097382`).
- Asked for guided callouts vs. a checklist (delivered hybrid in `1b5e01e`).
- Has NOT yet confirmed the remaining checklist items:
  - Dismiss → resume pill works
  - Restart tour clears state
  - Reset-on-login cycle (delete a roadmap → log out → log back in → it's back)
  - Isolation for non-demo users (log in as Ada → no tour UI)

### Open follow-ups raised at the pause point

The hybrid callout is live but only attaches to three elements. Two natural next steps were flagged in chat at the pause point:

1. **More `data-tour` targets.** Wire the callout to:
   - Step 3 (`roadmaps-toggle-step`): a step checkbox on a roadmap detail page (`StepRow.tsx`).
   - Step 4 (`roadmaps-reorder`): a milestone drag handle (`MilestoneCard.tsx`).
   - Step 7 (`jobs-open-interview`): the Linear job row in the jobs list (`JobListRow.tsx` — needs a way to find the Linear row by company name).
   - Step 8 (`jobs-add-round`): the "Add round" button in a job detail (`RoundsPanel.tsx` or similar).
   - Step 9 (`jobs-export-report`): the export-report menu item in the job actions menu (`JobActions.tsx`).

2. **Action-based auto-completion.** Today only navigation auto-advances. To make the tour feel truly guided, hook into specific user actions:
   - Toggling a step checkbox → auto-marks step 3.
   - Reordering a milestone (drag-end event) → auto-marks step 4.
   - Opening the round-form dialog → auto-marks step 8.
   - Opening the export-report dialog → auto-marks step 9.

   This requires either (a) a global event bus the tour subscribes to, or (b) a small `markComplete('id')` call sprinkled into the relevant action handlers. (b) is simpler — gated on `isDemoUser` so it's a no-op for everyone else.

### Pre-existing concerns (out of scope for this branch)

- `apps/web/` has untracked / modified files from before this session: `tailwind.config.*`, `vite.config.*`, `tsconfig*.tsbuildinfo`, `dropcap-fix-verify.png`, and a few plan files under `docs/superpowers/plans/`. They were carried through this branch but not committed. None are mine to touch — leave for the user.
- The web build emits a pre-existing chunk-size advisory warning. Not introduced by this branch.

## Load-bearing decisions made during execution

These aren't in the spec; they were judgment calls during execution and should be preserved.

1. **TourProvider is at App root, not inside `<Protected>`.** Final review caught that flat React-Router v6 routes remount per navigation; placing `TourProvider` inside `Protected` meant the tour state reset on every page change. Fix is in `6c00ee4`.

2. **Seed is two-pass (empty-insert + demo-backfill).** Real dev environments already had Ada/Alan/Grace, so the original `count > 0 → return` short-circuit meant the demo user never appeared. The seed now backfills the demo user without requiring a volume wipe. Fix is in `f7bd64c`.

3. **`getDemoFixtures` uses locally-defined seed types, not `InferSchemaType`.** Intentional — a future Mongoose schema rename will break the seed at compile time instead of silently passing.

4. **API tests substituted unit tests on fixture shape for real-DB integration tests.** The spec called for two integration tests against Mongo. The existing test suite uses `skipDb: true` and there's no integration harness. Rather than add `mongodb-memory-server` for this feature, the plan documents the deviation and the manual checklist (Task 15) covers the reset-cycle behavior.

5. **`resetDemoData` is fail-open in the login handler.** Try/catch around the reset only; cookie set and response proceed regardless. Spec rationale: "a broken demo is annoying, a broken login is a wall."

6. **`currentStepId` advances on `markComplete`, not just on `restart`.** This was the reviewer's recommendation and now matches the spec's "anchor to first step" intent. After `markComplete(id)`, `currentStepId` becomes the first uncompleted step (or `null` if all done). The floating callout relies on this.

7. **One-way completion (no manual uncheck).** Spec said "toggleable" but the a11y review converted completed-state into a non-interactive `<span>`. Completed steps can be reset only via the navbar's "Restart tour" item. Defensible UX choice; documented as a minor spec deviation.

## How to resume

1. **Check out the branch:**
   ```
   git checkout feat/demo-user-tour
   ```

2. **Bring up the stack:**
   ```
   docker compose up --build
   ```
   The seed will backfill the demo user on first boot.

3. **Verify the current state:** load `http://localhost:5173/login`, pick Pathfinder Demo, walk the tour. The floating callout should attach to the Roadmaps nav link first.

4. **Pick up the open follow-ups** (more `data-tour` targets, action-based auto-complete) OR finish the Task 15 manual checklist + use the `superpowers:finishing-a-development-branch` skill to merge.

5. **If shipping as-is:** invoke the `superpowers:finishing-a-development-branch` skill. It will guide creating a PR or merging back to `main`. The branch is at 23 commits and the spec is fully implemented modulo the documented deviations.

## File map

**Created**
- `apps/api/src/seedDemo.ts` — fixture builder + `resetDemoData`.
- `apps/api/test/seed-demo.test.ts` — 7 unit tests on fixture shape.
- `apps/web/src/components/tour/tourSteps.ts` — 9-step config, with `target` and `nextOnPath` on selected steps.
- `apps/web/src/components/tour/TourProvider.tsx` — context, auto-open, route auto-advance.
- `apps/web/src/components/tour/TourPanel.tsx` — floating side panel + resume pill.
- `apps/web/src/components/tour/TourCallout.tsx` — anchored floating arrow callout.
- `apps/web/src/components/tour/DemoBadge.tsx` — small amber pill.

**Modified**
- `packages/shared/src/user.ts` — `isDemoUser` on `UserSchema`, also picked into `DevUserSchema`.
- `apps/api/src/models/User.ts` — Mongoose field.
- `apps/api/src/plugins/auth.ts` — passthrough to `req.user`.
- `apps/api/src/seed.ts` — appended demo user + idempotent backfill.
- `apps/api/src/routes/auth.ts` — login handler hook + dev-users response includes `isDemoUser`.
- `apps/web/src/App.tsx` — wraps Routes with TourProvider, mounts TourPanel + TourCallout at App root.
- `apps/web/src/components/Navbar.tsx` — DemoBadge inline, Restart-tour menu item, `data-tour` attributes on Roadmaps/Jobs links.
- `apps/web/src/components/roadmaps/ImportRoadmapButton.tsx` — `data-tour` attribute on the Import button.
- `apps/web/src/pages/Login.tsx` — separator + DemoBadge for the demo user entry.
- `docs/PROJECT.md` — Changelog + Auth Strategy note.
