# Job Applications Feature — Design

**Status:** approved
**Date:** 2026-05-19
**Predecessors:**
- [2026-05-16-v0-walking-skeleton.md](../plans/2026-05-16-v0-walking-skeleton.md)
- [2026-05-17-roadmaps-feature-design.md](./2026-05-17-roadmaps-feature-design.md)

## Goal

Let a logged-in user track their job applications end-to-end — not just status, but the **interview prep and retrospection journal** that surrounds each application. Each application becomes a row in a single, scannable list and opens to a detail page where rounds of interviews are recorded with their own pre-prep notes, the questions actually asked, and the user's post-interview reflection. Second of the three deferred PROJECT.md features to ship after v0; resources is the only one still pending. Frontend implementation will be planned separately via the writing-plans skill; this spec defines the data model, API surface, frontend state shape, and component tree so that planning has a fixed contract to work against.

## Settled Decisions

| Topic | Decision | Why |
|---|---|---|
| Main view | Card-style row per application in a single chronological list, with status filter pills above. No Kanban board. | Mirrors how the user thinks about their search ("show me my applications"), not a project-management ritual; status filtering covers the cross-axis cheaply. |
| Row content | Company logo · company · role · tags · work-mode · location · salary · resume version · contact count · highlighted status pill (with `Round N of M` sub-label when interviewing) · highlighted date chip (`Applied / Saved / Closed`) · last-updated timestamp. | The user explicitly asked for status and dates to be highlighted and for more information per row. |
| Detail layout | Two-column sidebar layout: identity hero + status + quick facts + tags + linked roadmap + contacts + Edit/Archive/Delete on the left; application notes panel + interview-rounds timeline on the right. | Matches the existing roadmap detail pattern → consistent muscle memory across the app. |
| Interview rounds | Each application has an ordered list of rounds. Each round carries: name, scheduled date, duration, interviewer, outcome, pre-prep notes, questions asked, experience/reflection. | Mirrors how interview prep actually arrives — different round, different prep & questions. A phone screen and an onsite need different preparation and yield different notes. |
| Round outcome | Three states: `pending` (default) · `passed` · `failed`. The UI displays "Upcoming" when `scheduledAt > now` and outcome is still `pending` — that label is derived, not stored. | Three states cover reality; "upcoming" is implicit from the date. |
| Round reordering | Drag-and-drop via `@dnd-kit/sortable`, same as roadmap milestones and steps. | Order matters (Phone Screen → Technical → Onsite) and insertion mid-process is real. |
| Status workflow | `saved` · `applied` · `interviewing` · `offer` · `rejected` · `withdrawn`. Renamed `interview` → `interviewing` from the original PROJECT.md sketch for grammatical parity with the other participles. **Manual only** — adding a round does not auto-flip status. | Explicit transitions are predictable; no surprise state changes when the user adds a round just to take notes. |
| Resume | Single optional `resumeUrl` field (external URL — Google Drive, Dropbox, etc.). Display chip derives the filename from the URL's last path segment. | The user picked external URL; no file-upload infra is needed. |
| Tags | Free-form string array. Client-side substring filter on the main list. | What the user asked for; defers any "structured tag" decision until pressure forces it. |
| Optional fields kept | Contacts list (recruiter, hiring manager, referrer), linked roadmap, location + work mode, salary range / offer amount. | All four selected. |
| Salary fields | Free-form strings (`salaryRange`, `offerAmount`). | Covers `$180k–$220k`, `₹40L–₹60L`, `$240k base + 25%` without forcing structured numeric parsing. Personal scale doesn't need sortable salary. |
| Archive | Boolean `archived` flag. Archived apps live at `/jobs/archived`, mirrors roadmaps. | Reuse of the proven pattern. |
| Storage | Single Mongo doc per application, with `rounds` and `contacts` as embedded subdocument arrays. | Always loaded together; single-doc reads are atomic. Same pattern as `roadmaps`. |
| Routing | `/jobs`, `/jobs/archived`, `/jobs/:id`. | Reserves the `/jobs` namespace cleanly. |
| Search | Client-side substring filter against company, role, and tags. | Personal scale (dozens of apps) doesn't need server-side search; reuses already-loaded data. |
| Sort | Default: most-recently-updated first. Secondary toggle: applied date desc. | Live activity surfaces first; applied-date sort gives a chronological timeline read. |
| LLM import | **Not in scope.** Job apps are added one at a time; generation gives little leverage. | Skips the complexity; the bulk-import pattern from roadmaps can be revived later if it earns itself in. |

## Data Model

### Zod schemas (added to `packages/shared/src/`)

A new file `packages/shared/src/jobApplication.ts`, re-exported from `packages/shared/src/index.ts`.

```typescript
// packages/shared/src/jobApplication.ts
import { z } from 'zod';

export const JobApplicationStatusSchema = z.enum([
  'saved', 'applied', 'interviewing', 'offer', 'rejected', 'withdrawn',
]);
export type JobApplicationStatus = z.infer<typeof JobApplicationStatusSchema>;

export const WorkModeSchema = z.enum(['remote', 'hybrid', 'onsite']);
export type WorkMode = z.infer<typeof WorkModeSchema>;

export const RoundOutcomeSchema = z.enum(['pending', 'passed', 'failed']);
export type RoundOutcome = z.infer<typeof RoundOutcomeSchema>;

export const ContactSchema = z.object({
  _id: z.string(),
  name: z.string().min(1),
  role: z.string().optional(),
  email: z.string().email().optional(),
});
export type Contact = z.infer<typeof ContactSchema>;

export const InterviewRoundSchema = z.object({
  _id: z.string(),
  name: z.string().min(1),                    // "Phone Screen", "Technical", "Onsite"
  scheduledAt: z.coerce.date().optional(),
  durationMinutes: z.number().int().positive().optional(),
  interviewer: z.string().optional(),
  outcome: RoundOutcomeSchema.default('pending'),
  prepNotes: z.string().optional(),
  questions: z.array(z.string().min(1)).default([]),
  experience: z.string().optional(),
});
export type InterviewRound = z.infer<typeof InterviewRoundSchema>;

// Protocol check mirrors the BulkLinkSchema refinement in packages/shared/src/roadmap.ts —
// defense against `javascript:` / `data:` URLs in pasted input. Lift into a shared
// `HttpsHttpUrlSchema` helper if a third caller appears.
const httpHttpsUrl = z
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
    { message: 'URL must use http or https' },
  );

export const JobApplicationSchema = z.object({
  _id: z.string(),
  userId: z.string(),
  company: z.string().min(1),
  role: z.string().min(1),
  jobUrl: httpHttpsUrl.optional(),
  status: JobApplicationStatusSchema.default('saved'),
  appliedAt: z.coerce.date().optional(),
  resumeUrl: httpHttpsUrl.optional(),
  location: z.string().optional(),
  workMode: WorkModeSchema.optional(),
  salaryRange: z.string().optional(),         // free-form: "$180k – $220k"
  offerAmount: z.string().optional(),         // free-form: "$240k base + 25%"
  tags: z.array(z.string().min(1)).default([]),
  notes: z.string().optional(),
  contacts: z.array(ContactSchema).default([]),
  rounds: z.array(InterviewRoundSchema).default([]),
  links: z.object({ roadmapId: z.string().optional() }).default({}),
  archived: z.boolean().default(false),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type JobApplication = z.infer<typeof JobApplicationSchema>;

// Request shapes
export const CreateJobApplicationSchema = JobApplicationSchema
  .omit({ _id: true, userId: true, createdAt: true, updatedAt: true })
  .partial({ status: true, tags: true, contacts: true, rounds: true, links: true, archived: true })
  .required({ company: true, role: true });
export type CreateJobApplicationInput = z.infer<typeof CreateJobApplicationSchema>;

export const UpdateJobApplicationSchema = CreateJobApplicationSchema.partial();
export type UpdateJobApplicationInput = z.infer<typeof UpdateJobApplicationSchema>;

export const CreateRoundSchema = InterviewRoundSchema.omit({ _id: true }).partial({
  outcome: true, questions: true,
}).required({ name: true });
export type CreateRoundInput = z.infer<typeof CreateRoundSchema>;

export const UpdateRoundSchema = CreateRoundSchema.partial();
export type UpdateRoundInput = z.infer<typeof UpdateRoundSchema>;

export const CreateContactSchema = ContactSchema.omit({ _id: true }).required({ name: true });
export type CreateContactInput = z.infer<typeof CreateContactSchema>;

export const UpdateContactSchema = CreateContactSchema.partial();
export type UpdateContactInput = z.infer<typeof UpdateContactSchema>;

export const ReorderRoundsSchema = z.object({
  orderedIds: z.array(z.string()).min(1),
});
export type ReorderRoundsInput = z.infer<typeof ReorderRoundsSchema>;
```

### Mongoose model

`apps/api/src/models/JobApplication.ts` mirrors the Zod shape with `rounds` and `contacts` as nested subdocument arrays. Subdocument `_id`s are Mongo-generated.

**Indexes:**

- `{ userId: 1, archived: 1, updatedAt: -1 }` — main + archived list queries
- `{ userId: 1, 'links.roadmapId': 1 }` — sparse, supports a future "applications linked to this roadmap" view

### Shape notes

- **Salary is free-form strings.** No structured currency parsing. If structured salary becomes useful later, migrate to `{ min, max, currency }` then.
- **Status is manual.** Even adding a round does not auto-flip status to `interviewing`. The client sends an explicit PATCH if it wants to flip status.
- **No status timestamps** beyond `appliedAt` and the global `updatedAt`. A future `statusHistory` subdoc can capture per-state timestamps without breaking the current shape.
- **Round outcome is 3-state.** The "Upcoming" label is derived in the UI from `scheduledAt > now && outcome === 'pending'`.
- **"Round N of M" indicator** in the status block is derived, not stored. `M = rounds.length`. `N = index of the first round whose outcome is not 'passed'` (1-indexed). If every round has `outcome === 'passed'`, the indicator hides — the application has cleared its interview loop and the user-set status (`offer`/`rejected`/etc.) tells the rest of the story.
- **`links: { roadmapId? }`** is an object so additional link types (`resourceId`, etc.) can be added without a schema migration.

## API Surface

All routes live under `/api/jobs`, all require auth, every query filters by `req.user._id`. 404 (not 403) on cross-user access. Routes file: `apps/api/src/routes/jobs.ts`, registered in `apps/api/src/server.ts` alongside the existing roadmap routes.

| Method | Path | Body / Query | Purpose |
|---|---|---|---|
| GET | `/api/jobs` | `?archived=true\|false` (default `false`) | List user's job applications, newest-updated first |
| POST | `/api/jobs` | `CreateJobApplicationSchema` | Create application |
| GET | `/api/jobs/:id` | — | Get one application (404 if not user's) |
| PATCH | `/api/jobs/:id` | `UpdateJobApplicationSchema` | Update top-level fields (including `archived`) |
| DELETE | `/api/jobs/:id` | — | Hard-delete application |
| POST | `/api/jobs/:id/rounds` | `CreateRoundSchema` | Append a round to `rounds` |
| PATCH | `/api/jobs/:id/rounds/:roundId` | `UpdateRoundSchema` | Update round (name, dates, outcome, prepNotes, questions, experience) |
| DELETE | `/api/jobs/:id/rounds/:roundId` | — | Remove a round |
| PUT | `/api/jobs/:id/rounds/order` | `ReorderRoundsSchema` | Reorder rounds (drag-and-drop result) |
| POST | `/api/jobs/:id/contacts` | `CreateContactSchema` | Append a contact |
| PATCH | `/api/jobs/:id/contacts/:contactId` | `UpdateContactSchema` | Update contact |
| DELETE | `/api/jobs/:id/contacts/:contactId` | — | Remove a contact |

**Behavioral notes:**

- **Archive** is `PATCH /:id` with `{ archived: true }` — no dedicated endpoint. Mirrors the roadmaps API.
- **Update-round** is one fat PATCH rather than nested per-field endpoints — interview prep is usually edited as a block.
- **Reorder** is its own `PUT .../rounds/order` so the optimistic-update path stays atomic.
- **`status: 'interviewing'`** is never set server-side. The client owns status transitions.

## Frontend

### Routes

| Path | Component | Guard |
|---|---|---|
| `/jobs` | `JobsListPage` (`archived = false`) | `<RequireAuth>` |
| `/jobs/archived` | `JobsListPage` (`archived = true`) | `<RequireAuth>` |
| `/jobs/:id` | `JobDetailPage` | `<RequireAuth>` |

The navbar gains a "Jobs" link next to "Roadmaps".

### TanStack Query cache keys

- `['jobs', { archived }]` — list query
- `['jobs', id]` — single application

Mutations invalidate the relevant list key and the detail key (or set the detail key directly on the mutation response).

### Hooks (`apps/web/src/hooks/`)

- `useJobs({ archived })` · `useJob(id)`
- `useCreateJob`, `useUpdateJob`, `useDeleteJob`
- `useAddRound`, `useUpdateRound`, `useDeleteRound`, `useReorderRounds`
- `useAddContact`, `useUpdateContact`, `useDeleteContact`

### Component tree (`apps/web/src/components/jobs/`)

```
JobsListPage
├── JobsHeader              # title, "New application" button, archived/active toggle
├── JobFilters              # status pills with counts + free-text/tag filter input
└── JobListRow × N          # card-style row from the approved mockup

JobDetailPage
├── JobDetailSidebar
│   ├── JobIdentityHero     # logo, company, role
│   ├── StatusBlock         # big pill + "Round N of M" indicator + status picker
│   ├── QuickFacts          # appliedAt, mode, salary, jobUrl, resumeUrl
│   ├── TagsBlock           # chips, inline-add
│   ├── LinkedRoadmapBlock  # optional, shows roadmap title; clickable
│   ├── ContactsBlock       # list of ContactCard, with add/edit/delete
│   └── JobActions          # Edit · Archive · Delete
├── JobNotesPanel           # textarea, edit-in-place
└── RoundsPanel
    ├── RoundCard × N       # collapsible, drag-handle, outcome chip
    └── AddRoundButton

Shared dialogs
├── NewJobDialog            # multi-field create form (company, role required)
├── EditJobDialog           # full-edit modal for top-level fields
├── RoundFormDialog         # add/edit a round (multiple fields)
└── ContactFormDialog       # add/edit a contact
```

### Edit pattern

Matches the roadmap detail page's hybrid approach:

- **Inline** — status picker, tag add/remove, round outcome chip toggle, round drag-reorder, round collapse/expand
- **Modal** — create application, full-edit application, add/edit round (multi-field), add/edit contact
- **Edit-in-place** — application notes, per-round `prepNotes` and `experience` (click → textarea grows in place, blur → save)

### Optimistic updates

Consistent with the roadmap step-toggle and milestone-reorder patterns:

- Round outcome chip change
- Round reorder (drag-and-drop)
- Status change in the sidebar
- Archive / unarchive

### Empty states

- `/jobs` with zero apps: an empty illustration block + "Track your first application" → opens `NewJobDialog`
- `/jobs/archived` with zero: simple "Nothing archived yet." line
- App detail with zero rounds: "No interview rounds yet" + the `+ Add round` button visible

### Search & sort on the list page

- Filter input runs a client-side, case-insensitive substring match against `company`, `role`, and `tags`. Same shape as the roadmap list search.
- Status filter pills filter additionally; counts reflect the post-filter set per status.
- Default sort: `updatedAt` desc. Secondary toggle: `appliedAt` desc.

### Linked roadmap UX

- In the create/edit dialog, the "Linked roadmap" field is a typeahead populated from the user's active roadmaps (`useRoadmaps({ archived: false })`). Optional; empty by default.
- On the sidebar, clicking the linked-roadmap badge navigates to `/roadmaps/:id`.

## Out of Scope (deferred)

- **LLM bulk import** — job apps are added one at a time. Roadmap's bulk endpoint pattern can be revived later if it earns itself in.
- **Resume file upload** — external URLs only.
- **Structured salary** — free-form strings now; migrate to `{ min, max, currency }` if/when needed.
- **Status history / activity timeline** — only `appliedAt` and `updatedAt` are tracked.
- **Reminders / follow-up notifications** — no scheduled jobs, no email.
- **Email/calendar integration** — pulling interview invites from Gmail, syncing rounds to Google Calendar.
- **Analytics** — conversion rates, response-time histograms, per-source conversion.
- **Cross-roadmap view** — "show me every app linked to *Job hunt 2026*". The DB index supports it; the page just isn't built.
- **Server-side search** — client-side filtering is fine at personal scale.
- **Tests beyond a smoke test** — one Fastify integration test confirming `GET /api/jobs` returns 200 for an authed user, mirroring roadmap precedent. End-to-end browser tests still deferred.

## Future-Proofing Baked In

- `userId` is the first column of every index, on every document. Multi-tenant boundary preserved.
- `archived` flag pattern + `/jobs/archived` route mirror roadmaps, so muscle memory carries over.
- `links: { roadmapId? }` is an object so additional link types (`resourceId`, `interviewerId`, etc.) can be added without a schema migration.
- Salary as strings means no painful currency migration if it stays free-form forever.
- Round `outcome` and application `status` are closed enums but cheap to extend (`cancelled`, `ghosted`, `accepted` are obvious candidates).
- The detail page's edit pattern (inline for boolean/single-field toggles, modal for multi-field) is now used by both roadmaps and jobs — the third domain (resources) inherits the same convention for free.
