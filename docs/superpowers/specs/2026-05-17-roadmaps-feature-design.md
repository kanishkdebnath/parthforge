# Roadmaps Feature — Design

**Status:** approved
**Date:** 2026-05-17
**Predecessor:** v0 walking skeleton ([2026-05-16-v0-walking-skeleton.md](../plans/2026-05-16-v0-walking-skeleton.md))

## Goal

Let a logged-in user organize life goals as **roadmaps** — ordered checklists of milestones, where each milestone has its own ordered list of steps with reference links. First of the three deferred PROJECT.md features to ship after v0. Frontend implementation will be planned separately via the frontend-design skill; this spec defines the data model, API surface, frontend state shape, and component tree so that planning has a fixed contract to work against.

## Settled Decisions

| Topic | Decision | Why |
|---|---|---|
| Progress source | Auto from steps: % = completed / total. Milestone "done" derived. | Single source of truth; can't drift from the checkbox state. |
| Step links | Free-form `{ url, label? }` array per step. | No coupling to the deferred Resources feature. When Resources ships, it can cross-link TO steps via `Resource.links.milestoneId`; step URLs stay owned by the step. |
| Deadlines | Optional on both roadmap and milestone. None on steps. | Roadmap-level deadline anchors big goals; milestone deadlines are the working unit of time pressure; step deadlines would over-granularize. |
| Status | Boolean `archived` flag. Default `false`. | "Done" is derived (all milestones complete); "paused" collapses into archived. Two states, no UI for transitions beyond a single archive/unarchive button. |
| Reordering | Drag-and-drop via `@dnd-kit/sortable` for both milestones and steps. | Roadmaps are intrinsically ordered; up/down arrows are clunky for long lists; no reordering creates a trap. |
| Storage | Fully embedded — one Mongo doc per roadmap, milestones as subdocs, steps under milestones. | The query pattern is always "load this whole roadmap." PROJECT.md already sketches embedded milestones. Single-doc reads are atomic. |
| Link shape | `{ url, label? }`; label defaults to hostname when blank. | Readable display ("React docs" not `https://react.dev/learn/...`) without forcing the user to type a label. |
| Routing | `/roadmaps`, `/roadmaps/archived`, `/roadmaps/:id`. `/` stays the Welcome placeholder. | Clean namespace for when Resources and Jobs ship at `/resources` and `/jobs`. |
| Search/filter | Client-side substring filter against title, description, and milestone titles. Active/Archived stays a separate toggle. | Personal scale (dozens of roadmaps) doesn't need server-side search; reuse already-loaded data; filtering milestone titles helps find a roadmap by a memorable mini-goal. |

## Data Model

### Zod schemas (added to `packages/shared/src/`)

A new file `packages/shared/src/roadmap.ts`, plus `LinkSchema` either alongside or in its own `packages/shared/src/link.ts` (since the future Resources feature may share it).

```typescript
// packages/shared/src/link.ts
import { z } from 'zod';

export const LinkSchema = z.object({
  url: z.string().url(),
  label: z.string().optional(),
});

export type Link = z.infer<typeof LinkSchema>;
```

```typescript
// packages/shared/src/roadmap.ts
import { z } from 'zod';
import { LinkSchema } from './link.js';

export const StepSchema = z.object({
  _id: z.string(),
  title: z.string().min(1),
  links: z.array(LinkSchema).default([]),
  completed: z.boolean().default(false),
  completedAt: z.coerce.date().optional(),
});

export type Step = z.infer<typeof StepSchema>;

export const MilestoneSchema = z.object({
  _id: z.string(),
  title: z.string().min(1),
  description: z.string().optional(),
  deadline: z.coerce.date().optional(),
  steps: z.array(StepSchema).default([]),
  completedAt: z.coerce.date().optional(),
});

export type Milestone = z.infer<typeof MilestoneSchema>;

export const RoadmapSchema = z.object({
  _id: z.string(),
  userId: z.string(),
  title: z.string().min(1),
  description: z.string().optional(),
  deadline: z.coerce.date().optional(),
  archived: z.boolean().default(false),
  milestones: z.array(MilestoneSchema).default([]),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type Roadmap = z.infer<typeof RoadmapSchema>;

// Request shapes — narrow projections used by API validation and forms.
export const CreateRoadmapRequestSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  deadline: z.coerce.date().optional(),
});
export type CreateRoadmapRequest = z.infer<typeof CreateRoadmapRequestSchema>;

export const UpdateRoadmapRequestSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  deadline: z.coerce.date().nullable().optional(),  // nullable so clients can clear it
  archived: z.boolean().optional(),
});
export type UpdateRoadmapRequest = z.infer<typeof UpdateRoadmapRequestSchema>;

export const CreateMilestoneRequestSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  deadline: z.coerce.date().optional(),
});
export type CreateMilestoneRequest = z.infer<typeof CreateMilestoneRequestSchema>;

export const UpdateMilestoneRequestSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  deadline: z.coerce.date().nullable().optional(),
});
export type UpdateMilestoneRequest = z.infer<typeof UpdateMilestoneRequestSchema>;

export const CreateStepRequestSchema = z.object({
  title: z.string().min(1),
  links: z.array(LinkSchema).optional(),
});
export type CreateStepRequest = z.infer<typeof CreateStepRequestSchema>;

export const UpdateStepRequestSchema = z.object({
  title: z.string().min(1).optional(),
  links: z.array(LinkSchema).optional(),
  completed: z.boolean().optional(),
});
export type UpdateStepRequest = z.infer<typeof UpdateStepRequestSchema>;

export const ReorderRequestSchema = z.object({
  ids: z.array(z.string().regex(/^[a-f\d]{24}$/i)).min(1),
});
export type ReorderRequest = z.infer<typeof ReorderRequestSchema>;
```

Both exports get re-exported from `packages/shared/src/index.ts`.

### Mongoose model (`apps/api/src/models/Roadmap.ts`)

Embedded subdocument schemas; compound index on `{ userId: 1, archived: 1 }` so the most common list query (`find({ userId, archived: false })`) hits an index. Mongoose timestamps on the top-level roadmap schema only — milestone/step `completedAt` are application-managed, not auto.

```typescript
import { Schema, model, type InferSchemaType, Types } from 'mongoose';

const linkSchema = new Schema(
  { url: { type: String, required: true }, label: String },
  { _id: false }
);

const stepSchema = new Schema(
  {
    title: { type: String, required: true },
    links: { type: [linkSchema], default: [] },
    completed: { type: Boolean, default: false },
    completedAt: Date,
  },
  { _id: true }
);

const milestoneSchema = new Schema(
  {
    title: { type: String, required: true },
    description: String,
    deadline: Date,
    steps: { type: [stepSchema], default: [] },
    completedAt: Date,
  },
  { _id: true }
);

const roadmapSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true },
    description: String,
    deadline: Date,
    archived: { type: Boolean, default: false },
    milestones: { type: [milestoneSchema], default: [] },
  },
  { timestamps: true }
);

roadmapSchema.index({ userId: 1, archived: 1 });

export type RoadmapDoc = InferSchemaType<typeof roadmapSchema> & {
  _id: string;
  createdAt: Date;
  updatedAt: Date;
};

export const RoadmapModel = model('Roadmap', roadmapSchema);
```

(Following the Task 5 pattern of declaring `createdAt`/`updatedAt` explicitly on the inferred type because `InferSchemaType` doesn't surface timestamps.)

## API Surface

All routes under `/api/roadmaps`, all behind `app.authenticate`, all handlers filter by `req.user._id`. Every handler returns the **full updated roadmap document** (or list of documents) shaped to `RoadmapSchema` so the client can replace its cache atomically with no follow-up GET.

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/api/roadmaps?archived=false\|true` | — | `Roadmap[]` |
| POST | `/api/roadmaps` | `CreateRoadmapRequest` | `Roadmap` (201) |
| GET | `/api/roadmaps/:id` | — | `Roadmap` |
| PATCH | `/api/roadmaps/:id` | `UpdateRoadmapRequest` | `Roadmap` |
| DELETE | `/api/roadmaps/:id` | — | `{ ok: true }` (204-style) |
| POST | `/api/roadmaps/:id/milestones` | `CreateMilestoneRequest` | `Roadmap` (with new milestone appended) |
| PATCH | `/api/roadmaps/:id/milestones/:mid` | `UpdateMilestoneRequest` | `Roadmap` |
| DELETE | `/api/roadmaps/:id/milestones/:mid` | — | `Roadmap` |
| PUT | `/api/roadmaps/:id/milestones/reorder` | `ReorderRequest` (`ids` = milestone ObjectIds in new order) | `Roadmap` |
| POST | `/api/roadmaps/:id/milestones/:mid/steps` | `CreateStepRequest` | `Roadmap` |
| PATCH | `/api/roadmaps/:id/milestones/:mid/steps/:sid` | `UpdateStepRequest` | `Roadmap` |
| DELETE | `/api/roadmaps/:id/milestones/:mid/steps/:sid` | — | `Roadmap` |
| PUT | `/api/roadmaps/:id/milestones/:mid/steps/reorder` | `ReorderRequest` (`ids` = step ObjectIds in new order) | `Roadmap` |

### Three contract details worth pinning

1. **Granular endpoints, not whole-doc PUT.** Concurrent step toggles on the same roadmap would race under whole-doc PUT. Granular endpoints use Mongoose positional operators (`$set: { 'milestones.$[m].steps.$[s].completed': true }` with `arrayFilters: [{ 'm._id': mid }, { 's._id': sid }]`), so each mutation touches exactly the field it claims to.

2. **Server owns `completedAt` derivations.** Clients never send `completedAt`; they send `{ completed: true }` for a step. The server:
   - Sets `step.completedAt = new Date()` when `completed` flips false → true; clears it (`$unset`) when true → false.
   - After any change that affects step `completed` state (step toggle, step delete, step add), recomputes the milestone's `completedAt`: set to `new Date()` if every step in the milestone is now `completed`, cleared otherwise.
   - If a milestone has zero steps, `completedAt` stays unset (an empty milestone is not "done"; see "Edge cases").

3. **Reorder is a dedicated endpoint, not part of PATCH.** Body is `{ ids: string[] }` matching the new order. The server validates that the submitted set equals the existing set (no missing IDs, no extras) and rejects with 400 otherwise; this catches client bugs early. On valid input, the server replaces the array in the new order. Reorder requests don't change any other field.

### Authorization for nested resources

`:id`, `:mid`, `:sid` are all opaque to the URL. Authorization is "this roadmap belongs to `req.user._id`" — verified by the top-level lookup. If that passes, the `:mid` and `:sid` are validated to exist inside the doc; if they don't, 404. There's no separate "milestone ownership" or "step ownership" check because milestones and steps don't exist outside their parent roadmap.

### Validation at the boundary

All request bodies are validated by `<RequestSchema>.safeParse(request.body)` (the Task 7 pattern). Path params use the same ObjectId regex (`/^[a-f\d]{24}$/i`) as `LoginRequestSchema` to prevent CastErrors leaking as 500s. `ReorderRequestSchema.ids` validates the regex on every entry.

## Frontend Architecture

### Routes (additions to `apps/web/src/App.tsx`)

| Route | Component | Notes |
|---|---|---|
| `/roadmaps` | `RoadmapsListPage` | Active list. |
| `/roadmaps/archived` | `RoadmapsListPage` (passing `archived: true`) | Archive list. |
| `/roadmaps/:id` | `RoadmapDetailPage` | 404 panel inline on bad ID. |

Navbar gets a "Roadmaps" link. `/` stays the Welcome placeholder for now; it becomes a multi-feature hub when Resources and Jobs ship.

### TanStack Query keys

Extending the `['auth', 'me']` pattern from CLAUDE.md:

```typescript
['roadmaps', 'list', { archived: false }]
['roadmaps', 'list', { archived: true }]
['roadmaps', 'detail', id]
```

The hierarchical key shape lets one invalidation hit both lists at once (`invalidateQueries({ queryKey: ['roadmaps', 'list'] })`) without bothering individual detail entries.

### Hooks (`apps/web/src/hooks/useRoadmaps.ts`)

- `useRoadmaps({ archived })` — list query.
- `useRoadmap(id)` — detail query.
- `useCreateRoadmap`, `useUpdateRoadmap`, `useDeleteRoadmap`, `useArchiveRoadmap` (convenience for `useUpdateRoadmap` with `{ archived: true/false }`).
- `useAddMilestone`, `useUpdateMilestone`, `useDeleteMilestone`, `useReorderMilestones`.
- `useAddStep`, `useUpdateStep` (handles title/links/completed; a `useToggleStep` is a one-liner wrapper, no separate endpoint), `useDeleteStep`, `useReorderSteps`.

### Optimistic mutations (two only — keep this scoped)

- **Step toggle** — the highest-frequency interaction. `onMutate` writes the optimistic step state into the detail cache and returns the previous snapshot; `onError` rolls back; the response's full roadmap replaces the cache atomically. The milestone progress bar updates instantly because it derives from steps in the same cache entry.
- **Reorder (both milestones and steps)** — drag-and-drop must reflect immediately. Same `onMutate` / `onError` / `onSuccess` pattern: optimistic reorder of the array in the detail cache; rollback on error; server response replaces the cache on success.

All other mutations (create/update/delete) just invalidate the relevant keys — those are slower interactions where a brief loading state is acceptable.

### Component tree

```
RoadmapsListPage (/roadmaps and /roadmaps/archived)
├── PageHeader
│   ├── title ("Roadmaps" or "Archive")
│   └── "New roadmap" button (Active only)
├── RoadmapsToolbar
│   ├── SearchInput (case-insensitive substring match: title + description + milestone titles)
│   └── view switcher (Active / Archived link)
├── RoadmapCardGrid
│   └── RoadmapCard ×N
│       ├── title, description excerpt (2-line clamp)
│       ├── overall progress bar (% across all milestones' steps)
│       ├── milestone count + deadline badge (red if overdue)
│       └── click → /roadmaps/:id
├── EmptyRoadmapsState (no roadmaps at all in current view)
└── NoResultsState (filter has zero matches — distinct from empty)

NewRoadmapDialog (shadcn Dialog, opened from header button)
└── form: title (required), description, deadline (date picker)

RoadmapDetailPage (/roadmaps/:id)
├── RoadmapDetailHeader
│   ├── back link to /roadmaps
│   ├── title (inline editable)
│   ├── description (inline editable, multi-line)
│   ├── deadline badge (inline editable, clearable)
│   ├── overall progress bar
│   └── actions menu (Archive / Unarchive / Delete)
├── MilestoneList (SortableContext from @dnd-kit/sortable)
│   └── MilestoneCard ×N
│       ├── drag handle
│       ├── title, description, deadline (all inline editable)
│       ├── progress bar (steps in this milestone)
│       ├── StepList (nested SortableContext)
│       │   └── StepRow ×N
│       │       ├── drag handle
│       │       ├── checkbox (toggles completed — optimistic)
│       │       ├── title (inline editable)
│       │       ├── LinkChips (one chip per link; click → open in new tab)
│       │       ├── AddLinkInline ("+ link" button → small popover with url+label)
│       │       └── overflow menu: edit links / delete step
│       ├── AddStepInline (last row, placeholder "+ Add step"; Enter adds and shifts focus to a new empty row)
│       └── DeleteMilestoneConfirm (modal, includes step count in copy)
└── AddMilestoneInline (bottom of list, "+ Add milestone")

NotFoundPanel (rendered inside RoadmapDetailPage on 404 from GET)
└── "Roadmap not found." + back to /roadmaps link
```

### Inline editing protocol

Click → input focuses with current value selected → blur or Enter saves via the relevant `useUpdate*` mutation → Escape cancels and reverts. Single-line fields (titles, deadline) use `Input`/date picker; multi-line description uses `Textarea`. No "edit" button per field — the click target IS the field.

Exception: full forms with multiple fields (new roadmap, new milestone, link editor) use shadcn `Dialog`. The line is: ≤1 field = inline; >1 field = dialog.

### Drag-and-drop

`@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities`. Two separate `SortableContext`s — one wrapping the milestone list, one wrapping each milestone's step list. Drag handles are explicit (a `GripVertical` icon from `lucide-react`) so click targets on titles, checkboxes, and links don't conflict with drag initiation. Drop fires the reorder mutation; the cache is updated optimistically.

## Edge Cases & Behavior Pins

- **Roadmap with zero milestones.** Detail page shows the header + an `AddMilestoneInline` row with copy "Add your first milestone to get started." Overall progress bar reads 0% with a muted "—" label rather than a 0% bar.
- **Milestone with zero steps.** Card shows the header + `AddStepInline` row. Progress display reads "Add steps to track progress" (not a 0% bar). The milestone is not considered "done" — `completedAt` stays unset; the server enforces this in the recomputation rule.
- **All steps in a milestone become complete.** Server sets `milestone.completedAt`. UI shows a subtle "Done" badge on the milestone card.
- **All milestones become done.** UI shows a "Done" badge on the roadmap (derived client-side; not stored). The roadmap is **not** auto-archived — that's the user's decision.
- **Overdue deadlines.** Any deadline `< Date.now()` on an incomplete entity gets a red badge. No notifications, no sort reshuffle, no auto-archive.
- **Cross-user access attempt.** GET on a roadmap not owned by `req.user._id` returns 404 (not 403) to avoid revealing existence. Same pattern for all `/api/roadmaps/:id*` routes.
- **Empty search result.** Distinct from empty roadmaps state (`NoResultsState` vs `EmptyRoadmapsState`).
- **Optimistic mutation rollback.** When `onError` fires, the rollback restores the previous snapshot; a toast surfaces the error. Re-invalidate the detail key so the next read pulls server truth.
- **Delete a roadmap from non-archive view.** Disallowed in UI. The "Delete forever" affordance lives only in archive. (The DELETE endpoint allows it regardless — the UI restriction is one layer; if a future client wants to delete-without-archiving, the contract permits.)
- **Reorder mutation receives a stale ID set.** Server rejects with 400 "Reorder set does not match current order"; client invalidates the detail key and refetches to recover.

## Out of Scope for v1

These are deliberate omissions to keep v1 tight; they have a natural home in v2:

- Keyboard navigation beyond browser defaults (no arrow-key step traversal yet).
- Templates / duplicate roadmap.
- Cross-roadmap views ("all milestones due this week", "all incomplete steps").
- Notifications, email reminders, calendar integration.
- Search beyond client-side substring (no full-text, no fuzzy matching).
- Sharing / collaborators — Pathforge stays single-user for now.
- Comments, notes-history, audit log on edits.
- Markdown rendering in descriptions (plain text only for v1; multi-line is preserved via CSS `white-space: pre-wrap`).
- Pagination on the roadmaps list — not needed at expected scale.

## Implementation Plan Handoff

This spec defines the contract. The implementation plan (next step) will sequence the work — likely along these lines, but the writing-plans skill owns the actual decomposition:

- Backend shared types (Zod schemas in `@pathforge/shared`).
- Mongoose model + indexes.
- API routes (split into roadmap-level CRUD, milestone CRUD + reorder, step CRUD + reorder).
- Frontend hooks (TanStack Query queries + mutations).
- Frontend routing + page shells.
- List page (cards, search, archive toggle, new-roadmap dialog).
- Detail page (header, milestone list, step list).
- Drag-and-drop wiring.
- Optimistic mutation paths.

The frontend visual design (layout, spacing, copy, polish) is intentionally underspecified here — that's the frontend-design skill's job in the follow-up planning pass.
