# Journal — Design

*2026-05-21*

## Purpose

Add a per-user daily journal: one entry per calendar day capturing mood, a short summary, a list of timestamped events, external links, and references back into the user's own roadmaps and job applications. Becomes a fourth peer feature alongside Roadmaps, Jobs, and Resources.

The feature is "blended" — it serves three uses in one model:
- **Daily reflection** (mood + summary per day).
- **Event log** (a list of moments inside the day, each with an optional time and importance flag).
- **Goal-linked progress journal** (day-level references to roadmaps, milestones, or jobs).

## Goals

- A new `/journal` route with a compact month calendar on the left and a full day editor on the right. Selected day driven by `?date=YYYY-MM-DD` so views are deep-linkable.
- A dashboard "Today" card that prompts for today's mood when no entry exists and shows mood + summary when one does.
- Demo user (`Pathfinder Demo`) gets ~10–12 seeded journal days wiped + reseeded on every login, identical pattern to roadmaps/jobs reset.
- All existing load-bearing rules in `CLAUDE.md` preserved: shared Zod schemas, `userId` on every record, `withCredentials` on axios, TanStack Query cache keys, `<RequireAuth>` route guarding.

## Non-Goals (v1)

- Tour integration. The tour module was just stabilized; adding journal steps risks regression. The seeded demo days + dashboard widget are the discoverability surface.
- Text search across journal entries.
- Mood charts / analytics.
- Photo or file attachments.
- User-defined mood tags (the list is a curated constant in `@pathforge/shared`).
- Sharing, export, or import.
- Per-event CRUD endpoints — the day is the API unit.
- Auto-save. Save is a manual button click in v1.
- Optimistic concurrency. Last write wins.
- Frontend test infrastructure beyond what already exists (none for journal).

## Architecture

```
                       /journal route
                              │
                              ▼
        ┌─ apps/web ────────────────────────────────┐
        │ JournalPage (selected-date state via URL) │
        │ ├── JournalMonthGrid    (heatmap month)   │
        │ └── DayEditor                             │
        │     ├── MoodPicker                        │
        │     ├── EventList / EventRow             │
        │     ├── LinksEditor                       │
        │     └── ReferencesPicker                  │
        │                                           │
        │ Dashboard home                            │
        │ └── JournalTodayCard                      │
        └─────────────┬─────────────────────────────┘
                      │ HTTP (cookies)
                      ▼
        ┌─ apps/api ────────────────────────────────┐
        │ /api/journal/days            (list)       │
        │ /api/journal/days/:date      (CRUD-by-date)│
        │     │                                     │
        │     ▼                                     │
        │  JournalDay model (Mongoose)              │
        │  index: { userId: 1, date: -1 } UNIQUE    │
        └─────────────┬─────────────────────────────┘
                      │
                      ▼
        ┌─ packages/shared ─────────────────────────┐
        │ journalDay.ts:                            │
        │   MOOD_TAGS, MoodSchema, EventSchema,     │
        │   ReferenceSchema (discriminated union),  │
        │   JournalDaySchema,                       │
        │   UpsertJournalDayRequestSchema           │
        └───────────────────────────────────────────┘
```

## Load-Bearing Rules Respected

- **`packages/shared` is the keystone.** Every journal shape is a Zod schema defined once and imported by both API (validation + Mongoose alignment) and web (forms + types).
- **Every collection carries `userId`.** `journalDays.userId` is set from `req.user.id` on every write; every query filters by it; the compound unique index `{ userId: 1, date: -1 }` starts with `userId`.
- **Auth shape stable.** No changes to `/api/auth/*`. Journal routes use the existing cookie-session middleware to attach `req.user`.
- **Axios `withCredentials`** preserved; journal hooks reuse the existing client.
- **TanStack Query** owns server state. New keys: `['journal', 'month', 'YYYY-MM']` and `['journal', 'day', 'YYYY-MM-DD']`. Mutations invalidate both.
- **`<RequireAuth>`** wraps `/journal`; no ad-hoc auth checks inside the page.

## Data Model

### Shared schemas — `packages/shared/src/journalDay.ts`

```ts
// Curated mood tag list — constant exported for the picker.
export const MOOD_TAGS = [
  'focused', 'tired', 'anxious', 'grateful',
  'restless', 'excited', 'low', 'calm',
] as const;
export const MoodTagSchema = z.enum(MOOD_TAGS);

export const MoodSchema = z.object({
  scale: z.number().int().min(1).max(5),         // 1 = 😢 … 5 = 😄
  tags: z.array(MoodTagSchema).max(3).default([]),
});

export const EventSchema = z.object({
  _id: ObjectIdString,
  text: z.string().min(1).max(500),
  important: z.boolean().default(false),
  time: z.string().max(20).optional(),           // free-form: "morning", "3pm"
});

// Discriminated union — internal references to user's own docs.
export const ReferenceSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('roadmap'),   roadmapId: ObjectIdString }),
  z.object({ type: z.literal('milestone'), roadmapId: ObjectIdString, milestoneId: ObjectIdString }),
  z.object({ type: z.literal('job'),       jobId: ObjectIdString }),
]);

// YYYY-MM-DD string. A calendar day is intentionally timezone-less;
// the client computes "today" in the user's local tz and passes the string.
export const DateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const JournalDaySchema = z.object({
  _id: ObjectIdString,
  userId: ObjectIdString,
  date: DateStringSchema,
  mood: MoodSchema,
  summary: z.string().max(500).optional(),
  events: z.array(EventSchema).max(20).default([]),
  links: z.array(LinkSchema).max(10).default([]),
  references: z.array(ReferenceSchema).max(10).default([]),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

// Upsert request — full-day replacement. Event _ids are optional on input:
// preserved when present, server-assigned when absent.
export const UpsertJournalDayRequestSchema = z.object({
  mood: MoodSchema,
  summary: z.string().max(500).optional(),
  events: z.array(EventSchema.partial({ _id: true })).max(20).default([]),
  links: z.array(LinkSchema).max(10).default([]),
  references: z.array(ReferenceSchema).max(10).default([]),
});
```

Exported via `packages/shared/src/index.ts` alongside the existing schemas.

### Mongoose model — `apps/api/src/models/JournalDay.ts`

Mirrors the Zod shape. Indexes:

```ts
journalDaySchema.index({ userId: 1, date: -1 }, { unique: true });
```

### Key choices, explicit

| Choice | Rationale |
|---|---|
| `date` as a YYYY-MM-DD string, not a `Date` | A calendar day is timezone-less by nature; using a string avoids tz drift bugs when the user travels or the server runs in a different zone. |
| Full-day PUT (no per-event endpoints) | A day's content is bounded (≤20 events, ≤10 links, ≤10 refs). Replacing the whole array on save matches the editor's draft-state model and keeps the API minimal. |
| References are skinny — `type + ids` only | Avoids stale denormalized labels. The frontend joins with the user's cached roadmaps/jobs lists for display. Deleted targets render as "(deleted)" chips, not corrupted data. |
| No `order` field on events | Array order is the order. Drag-reorder updates the array; full-day PUT preserves it. |
| Mood scale required, summary + tags + events + links + refs optional | A "minimum entry" is just a mood. The dashboard widget's quick-mood-set creates a valid day in one tap. |

## API Surface

All under `/api/journal`. Auth required (existing cookie-session middleware attaches `req.user`). Every query filters by `req.user.id`.

| Method | Path | Body | Returns |
|---|---|---|---|
| `GET`    | `/api/journal/days?from=YYYY-MM-DD&to=YYYY-MM-DD` | — | `JournalDay[]` sorted by date desc, only days that exist |
| `GET`    | `/api/journal/days/:date` | — | `JournalDay` or `404` |
| `PUT`    | `/api/journal/days/:date` | `UpsertJournalDayRequest` | `JournalDay` (full, with server-assigned event `_id`s) |
| `DELETE` | `/api/journal/days/:date` | — | `204` |

### Validation

- `:date` and `from`/`to` query params must match `DateStringSchema`.
- `from <= to`, range capped at 366 days. Defense against `from=1900-01-01&to=3000-01-01` scans.
- Body parsed by `UpsertJournalDayRequestSchema`.
- **Reference ownership check** on `PUT`: for each `ReferenceSchema` entry, verify the target doc exists and `userId` matches `req.user.id`. Invalid → `400` with `{ error: 'invalid-reference', ref }`. Prevents inserting refs to docs the user doesn't own and surfaces orphans early.

### Behavior

- `PUT` is an upsert. Existing event `_id`s in the body are preserved verbatim; missing `_id`s are server-assigned. `createdAt` is set on first PUT only; `updatedAt` on every PUT.
- Race: last-write-wins via Mongo's atomic upsert. No optimistic concurrency in v1.
- `GET` range returns only days that exist — the calendar paints `undefined` cells differently from low-mood cells.
- **No dedicated `/today` endpoint** — the client computes today's date in local tz and calls `GET /api/journal/days/{today}`, treating `404` as "no entry yet."

## Frontend

### Route

`/journal` under `<RequireAuth>`. Selected day driven by `?date=YYYY-MM-DD`. Default: today.

Navbar adds "Journal" between Roadmaps and Jobs.

### Layout (the "compact month + day panel" design)

Two columns. Left: ~280px month calendar with a 5-stop mood color scale (low → high). Right: the day editor. No drilling — read and write inline.

```
┌─ Journal ──────────────────────────────────────────────────┐
│  ┌──────────────┐   ┌───────────────────────────────────┐  │
│  │ May 2026  ‹›│   │ Thu, May 14, 2026                 │  │
│  │  S M T W T F S│   │                                   │  │
│  │  ░ ░ ░ ▣ ▣ ░ ░│   │ Mood   😢 😟 😐 [🙂] 😄            │  │
│  │  ▣ ▣ ▤ ░ ▣ ▣ ░│   │ Tags   [focused] [grateful]       │  │
│  │  ▣ ▥ ▣ ▣ ░ ▥ ▣│   │                                   │  │
│  │  ░ ▣ ▣ ▣ ░ ░ ░│   │ Summary [______________________]  │  │
│  │  ░ ░ ░ ░ ░ ░ ░│   │                                   │  │
│  │  low ─────  high│   │ Events                            │  │
│  └──────────────┘   │  ⭐ 10am  Shipped tour fixes  ✕   │  │
│                     │  ☆  —     Stuck on routing    ✕   │  │
│                     │  [+ add event]                    │  │
│                     │                                   │  │
│                     │ Links                             │  │
│                     │  github.com/... "PR #42"     ✕   │  │
│                     │  [+ add link]                     │  │
│                     │                                   │  │
│                     │ References                        │  │
│                     │  [roadmap React migration ✕]      │  │
│                     │  [job Acme — Senior Eng    ✕]    │  │
│                     │  [+ add reference]                │  │
│                     │                       [ Save ]    │  │
│                     └───────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘
```

### Components — `apps/web/src/components/journal/`

| Component | Responsibility |
|---|---|
| `JournalPage.tsx`        | Route shell. Reads `?date` from URL, holds the two-column layout, passes selected date down. |
| `JournalMonthGrid.tsx`   | Compact heatmap month, month nav, click → updates `?date`. Uses `useJournalMonth`. |
| `DayEditor.tsx`          | Owns the working draft of the current day. Seeds from fetched day or empty template. Orchestrates sub-editors. Hosts Save mutation. |
| `MoodPicker.tsx`         | 5 emoji buttons (scale 1–5) + tag chip multi-select up to 3. |
| `EventList.tsx` / `EventRow.tsx` | Inline-editable rows: ★ important toggle, optional time field, text, delete. |
| `LinksEditor.tsx`        | `{url, label?}` rows. URL must validate against `LinkSchema` (http/https). |
| `ReferencesPicker.tsx`   | Chips for attached refs. "Add reference" opens a combobox that searches the user's roadmaps (and their milestones) and jobs. Mounts trigger prefetch of `['roadmaps']` and `['jobs']` so the chip labels render synchronously. |
| `JournalTodayCard.tsx`   | Dashboard widget. Lives in `apps/web/src/components/dashboard/` or wherever the dashboard composes from. |

### Hooks — `apps/web/src/hooks/`

- `useJournalMonth(yyyyMm)` → `GET ?from&to`. Cache key `['journal', 'month', yyyyMm]`.
- `useJournalDay(date)` → `GET /api/journal/days/:date`. 404 returns `null`, not an error. Cache key `['journal', 'day', date]`.
- `useUpsertJournalDay()` → `PUT /api/journal/days/:date`. On success: invalidate `['journal', 'day', date]` and `['journal', 'month', yyyyMm]` for that date's month.
- `useDeleteJournalDay()` → `DELETE /api/journal/days/:date`. Same invalidation.

### Editor state model

`DayEditor` holds a local draft in `useState<Draft>`, seeded from the fetched day or an empty template (`{ mood: { scale: 3, tags: [] }, events: [], links: [], references: [] }`).

- New events get a client-side temporary `_id` (e.g., `crypto.randomUUID()`) for stable React list keys. These are stripped from the PUT body so the server assigns a real `ObjectId`.
- Save button is **disabled until draft differs from server state**, then enabled. Click → PUT → on success, replace the local draft with the server's response.
- Validation errors (rare — the form constrains inputs to valid shapes) show inline above the Save button.

### Empty states

- **No day for selected date.** Editor shows the date header and the empty draft template. Mood scale is required to save; clicking Save without a scale is a no-op (button stays disabled).
- **Empty month.** Grid renders all cells in "no entry" style. Calendar still navigates by month.
- **Dashboard widget with no entry for today.** Renders "How are you feeling today?" + 5 emoji buttons. Clicking one writes a mood-only day for today and routes to `/journal?date={today}`.

### Aesthetic

Match the established Stripe/Apple feel established by the roadmaps redesign: Inter throughout, sky/emerald/red palette. Mood scale colors run red → orange → grey → green → sky on a 5-stop gradient. shadcn/ui primitives reused (Button, Input, Card, Combobox for the reference picker).

## Demo User Seeding

Extends `apps/api/src/seedDemo.ts`. The existing `resetDemoData()` wipes `roadmaps` and `jobApplications` by `userId`; add `journalDays` to that wipe + a seed step right after.

### Seeded shape — ~10–12 days

Days walk backwards from the demo user's "today" (computed server-side as `new Date()` formatted as YYYY-MM-DD in UTC; the slight drift vs the demoer's local "today" is acceptable for illustrative data):

| Offset | Mood | Tags | Events | Links | References |
|---|---|---|---|---|---|
| Day 0   | 4 | focused, grateful  | 3 (1 ★) | 1 | 1 roadmap   |
| Day -1  | 3 | restless           | 2       | — | —           |
| Day -2  | — | —                  | — (skipped — shows the "no entry" calendar state) | — | — |
| Day -3  | 4 | focused            | 2       | 1 | 1 milestone |
| Day -4  | 2 | tired, low         | 1       | — | 1 job       |
| Day -5  | 5 | excited, grateful  | 4 (2 ★) | 2 | 1 roadmap   |
| Day -6  | 3 | calm               | 1       | — | —           |
| Day -7  | 4 | focused            | 2       | 1 | 1 milestone |
| Day -8  | 3 | —                  | —       | — | —           |
| Day -9  | 4 | grateful           | —       | — | —           |
| Day -10 | 3 | —                  | —       | — | —           |
| Day -11 | 4 | calm               | —       | — | —           |

Every seeded day (except Day -2, intentionally absent) has a one-line summary. The shape is chosen so the calendar visibly varies in mood color, includes one empty day to show the "no entry" state, and the references point into the demo roadmaps and jobs the same routine seeds (titles + ids are known at the call site).

Across the set, each feature is exercised at least once: important flag, time field, external link, roadmap reference, milestone reference, job reference, multiple tags, and an empty day.

## Error Handling

| Scenario | Behavior |
|---|---|
| Invalid `:date` param                  | `400` with Zod error |
| `from > to` or range > 366 days        | `400` |
| `PUT` body fails schema                | `400` with Zod error |
| Reference target not owned by user     | `400` with `{ error: 'invalid-reference', ref }` |
| Reference target deleted between writes| Same as above on the next PUT. Existing days with orphaned refs render as "(deleted)" chips. |
| `GET` single day with no record        | `404`; frontend treats as empty state |
| Mood scale outside 1–5, tag not in `MOOD_TAGS` | `400` via Zod |
| Two PUTs to the same date              | Last write wins (Mongo upsert is atomic) |
| Event count > 20, link/ref count > 10  | `400` via Zod. Frontend hides the "+ add" button at the limit. |

## Testing

Match the existing `apps/api/test/` pattern (`jobs.test.ts`, `seed-demo.test.ts`, `bulk-roadmap-schema.test.ts`).

### `apps/api/test/journal.test.ts` — integration tests with real Mongo

- Auth required: `GET` / `PUT` / `DELETE` all return `401` without the session cookie.
- `PUT` creates a new day for an unused date.
- `PUT` updates an existing day; event `_id`s are preserved when present in the body, server-assigned when absent.
- `PUT` rejects: bad date param, body that fails `UpsertJournalDayRequestSchema`, mood scale outside 1–5, tag outside `MOOD_TAGS`, references to roadmap/milestone/job not owned by `req.user.id`.
- `GET` single returns `404` when no day exists.
- `GET` range returns days sorted desc; honors `from` and `to`; rejects range > 366 days.
- `DELETE` removes the day; subsequent `GET` returns `404`.
- Multi-user isolation: User A's day is invisible to User B.

### `apps/api/test/journal-schema.test.ts` — Zod parse tests

- `JournalDaySchema` accepts a canonical day; rejects bad date format, too many events/links/references, invalid mood tag.
- `ReferenceSchema` discriminated union parses each variant; rejects missing `milestoneId` when `type === 'milestone'`.
- `UpsertJournalDayRequestSchema` accepts events with and without `_id`.

### `apps/api/test/seed-demo.test.ts` — extend existing

- After a demo reset, `journalDays` collection has the expected ~10–12 days for the demo user with valid mood/events/references.
- Re-running demo login wipes prior journal days and reseeds (no doubling).

### Frontend testing — deferred

Match the project's posture: no jest/vitest tests on the web app for now. Manual smoke through `docker compose up` is the verification gate, plus type-check + build pass.

## Open Questions

None. All scope, shape, and UX choices resolved during brainstorming.
