# Job Applications — Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the frontend half of the Job Applications feature: TanStack Query hooks for all 12 endpoints, three routes (`/jobs`, `/jobs/archived`, `/jobs/:id`), a card-style list page with status-filter pills, and a two-column detail page with a status-rich sidebar, an interview-rounds timeline (with drag-and-drop reorder), inline-edit notes, and dialog-based multi-field forms. Matches the approved spec.

**Architecture:** Mirrors the existing **Roadmaps** frontend pattern almost step-for-step — hooks under `apps/web/src/hooks/`, components under `apps/web/src/components/jobs/`, pages under `apps/web/src/pages/`. Reuses shared primitives (`InlineEditableTitle`, `RingProgress` if helpful, shadcn UI primitives, the axios client, `<RequireAuth>` wrapper, `sonner` for toasts). New surface where the spec diverges from roadmaps: status filter pills with counts, the card-style row design, the round timeline with per-round sections (prep/questions/experience), and the linked-roadmap typeahead.

**Tech Stack:** React 18, Vite, TypeScript, Tailwind, shadcn/ui, TanStack Query, React Router, `@dnd-kit/sortable`, react-day-picker (via shadcn `Calendar`), sonner. All dependencies already installed in `apps/web/package.json`.

**Spec:** [docs/superpowers/specs/2026-05-19-job-applications-design.md](../specs/2026-05-19-job-applications-design.md)

**Predecessor:** [docs/superpowers/plans/2026-05-19-job-applications-backend.md](./2026-05-19-job-applications-backend.md) — backend shipped, all 12 endpoints live under `/api/jobs`.

---

## File Map

**Create (hooks + pages):**
- `apps/web/src/hooks/useJobs.ts` — `useJobs`, `useJob`, and 10 mutation hooks. Mirrors `useRoadmaps.ts`.
- `apps/web/src/pages/JobsListPage.tsx` — list of applications with status pills and search.
- `apps/web/src/pages/JobDetailPage.tsx` — two-column detail layout.

**Create (components — `apps/web/src/components/jobs/`):**
- `JobsListHeader.tsx` — title row, "New application" button, archived-toggle context.
- `JobsToolbar.tsx` — Active/Archive segmented control + status filter pills with counts + search input.
- `JobListRow.tsx` — the card-style row from the approved mockup.
- `EmptyJobsState.tsx` — "no apps yet" / "nothing archived" empty state.
- `NoJobResultsState.tsx` — "no matches for …" state.
- `NewJobDialog.tsx` — create form (company + role required; rest optional).
- `EditJobDialog.tsx` — full-edit modal for top-level fields.
- `DeleteJobConfirm.tsx` — delete confirmation dialog.
- `JobDetailSidebar.tsx` — left column container.
- `JobIdentityHero.tsx` — company name + role + logo box.
- `StatusBlock.tsx` — large status pill + "Round N of M" + status picker (dropdown).
- `QuickFactsBlock.tsx` — applied-on, mode, salary, jobUrl, resumeUrl, resume version chip.
- `TagsBlock.tsx` — tag chips + inline-add input.
- `LinkedRoadmapBlock.tsx` — pill that navigates to the linked roadmap (if present).
- `ContactsBlock.tsx` — list of `ContactCard` + add button.
- `ContactCard.tsx` — single contact row (avatar initials, name, role, email).
- `ContactFormDialog.tsx` — add/edit contact (name + role + email).
- `JobActions.tsx` — Edit · Archive · Delete buttons (open dialogs).
- `JobNotesPanel.tsx` — application-level notes, edit-in-place textarea.
- `RoundsPanel.tsx` — header + drag-and-drop list of rounds + "+ Add round" button.
- `RoundCard.tsx` — single round, collapsible, outcome chip toggle, drag handle.
- `RoundFormDialog.tsx` — add/edit round (multi-field form).
- `LinkedRoadmapPicker.tsx` — typeahead used inside `EditJobDialog` / `NewJobDialog` for selecting a roadmap to link.

**Modify:**
- `apps/web/src/App.tsx` — register three new routes.
- `apps/web/src/components/Navbar.tsx` — add "Jobs" link next to "Roadmaps".

**Out of scope (covered by spec's deferred list):**
- File-upload resume support (we use `resumeUrl` only).
- Reminders, analytics, status history timeline.
- Server-side search.
- Anything web tests beyond `npm -w @pathforge/web run build` and manual dev-server verification.

---

## Task Conventions

- All commands run from the repo root (`/Users/kanishkdebnath/Developer/pathforge`).
- Commit at the end of every task. Tone matches the project: `feat(web): …`, `chore(web): …`.
- Steps marked `[Read first]` are orientation reads against the existing roadmap sibling — they exist because every new component has a near-twin to imitate. Skip a `[Read first]` step only if you've already absorbed that file in the current session.
- Default verification command per task: `npm -w @pathforge/web run build` — runs `tsc -b && vite build`, exercises both type-checking and the Vite bundler. A clean build is the bar; per-task functional verification is optional via `npm -w @pathforge/web run dev` + browser.
- "Mirror the roadmap" means: visual classes, dark-mode coverage (`dark:` variants on every text/bg/border), the same shadcn primitives, the same edit pattern (inline / modal / edit-in-place). Where this plan diverges from roadmaps (status filter pills, round timeline, linked-roadmap typeahead), the divergence is called out explicitly and the code is provided.
- Existing brand colors / utility classes the plan reuses verbatim: `bg-brand`, `bg-brand-hover`, `text-overdue`, the slate ladders, `text-xs`/`text-sm` rhythm. They are already defined in `tailwind.config.ts`.

---

## Task 1 — Hooks file (`useJobs.ts`)

**Files:**
- Create: `apps/web/src/hooks/useJobs.ts`

Single file containing all 12 hooks plus shared query-key helpers. Mirrors the structure of `apps/web/src/hooks/useRoadmaps.ts`.

- [ ] **Step 1: [Read first] Absorb the sibling**

Read `apps/web/src/hooks/useRoadmaps.ts` end-to-end. Internalize: `LIST_KEY`/`DETAIL_KEY`/`LIST_PREFIX` query-key shapes, the `useQuery` pattern for reads (including 404→null in `useRoadmap`), the `useMutation` pattern for writes, and the two optimistic-update branches (reorder + step toggle).

- [ ] **Step 2: Create the hooks file**

Create `apps/web/src/hooks/useJobs.ts`:

```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { toast } from 'sonner';
import type {
  JobApplication,
  JobApplicationStatus,
  RoundOutcome,
  WorkMode,
} from '@pathforge/shared';
import { api } from '../lib/api';

// ---- Query keys ----
const LIST_KEY = (archived: boolean) =>
  ['jobs', 'list', { archived }] as const;
const DETAIL_KEY = (id: string) => ['jobs', 'detail', id] as const;
const LIST_PREFIX = ['jobs', 'list'] as const;

// ---- Request body shapes (mirror packages/shared, narrowed to what web sends) ----
type CreateJobBody = {
  company: string;
  role: string;
  jobUrl?: string;
  status?: JobApplicationStatus;
  appliedAt?: Date;
  resumeUrl?: string;
  location?: string;
  workMode?: WorkMode;
  salaryRange?: string;
  offerAmount?: string;
  tags?: string[];
  notes?: string;
  links?: { roadmapId?: string };
};

type UpdateJobBody = {
  [K in keyof CreateJobBody]?:
    | CreateJobBody[K]
    | null;
} & {
  archived?: boolean;
};

type CreateRoundBody = {
  name: string;
  scheduledAt?: Date;
  durationMinutes?: number;
  interviewer?: string;
  outcome?: RoundOutcome;
  prepNotes?: string;
  questions?: string[];
  experience?: string;
};

type UpdateRoundBody = {
  [K in keyof CreateRoundBody]?: CreateRoundBody[K] | null;
};

type CreateContactBody = {
  name: string;
  role?: string;
  email?: string;
};

type UpdateContactBody = {
  [K in keyof CreateContactBody]?: CreateContactBody[K] | null;
};

// ---- Reads ----

export function useJobs({ archived }: { archived: boolean }) {
  return useQuery({
    queryKey: LIST_KEY(archived),
    queryFn: async (): Promise<JobApplication[]> => {
      const res = await api.get('/jobs', { params: { archived } });
      return res.data;
    },
  });
}

export function useJob(id: string | undefined) {
  return useQuery({
    queryKey: id ? DETAIL_KEY(id) : ['jobs', 'detail', 'none'],
    enabled: !!id,
    queryFn: async (): Promise<JobApplication | null> => {
      if (!id) return null;
      try {
        const res = await api.get(`/jobs/${id}`);
        return res.data;
      } catch (err) {
        if (err instanceof AxiosError && err.response?.status === 404) {
          return null;
        }
        throw err;
      }
    },
  });
}

// ---- Application CRUD ----

export function useCreateJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateJobBody): Promise<JobApplication> => {
      const res = await api.post('/jobs', body);
      return res.data;
    },
    onSuccess: (fresh) => {
      qc.setQueryData(DETAIL_KEY(fresh._id), fresh);
      qc.invalidateQueries({ queryKey: LIST_PREFIX });
    },
    onError: () => {
      toast.error('Could not create application');
    },
  });
}

export function useUpdateJob(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: UpdateJobBody): Promise<JobApplication> => {
      const res = await api.patch(`/jobs/${id}`, body);
      return res.data;
    },
    // Optimize only the status flip (the most frequent inline action via
    // the sidebar status picker). Other patches go through the normal
    // success path. Mirrors the useUpdateStep partial-optimistic shape
    // in useRoadmaps.
    onMutate: async (body) => {
      if (body.status === undefined) return {};
      await qc.cancelQueries({ queryKey: DETAIL_KEY(id) });
      const prev = qc.getQueryData<JobApplication>(DETAIL_KEY(id));
      if (!prev) return { prev };
      qc.setQueryData<JobApplication>(DETAIL_KEY(id), {
        ...prev,
        status: body.status as JobApplication['status'],
      });
      return { prev };
    },
    onError: (_err, _body, ctx) => {
      if (ctx?.prev) qc.setQueryData(DETAIL_KEY(id), ctx.prev);
      toast.error('Could not save changes');
    },
    onSuccess: (fresh) => {
      qc.setQueryData(DETAIL_KEY(id), fresh);
      qc.invalidateQueries({ queryKey: LIST_PREFIX });
    },
  });
}

export function useArchiveJob(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (archived: boolean): Promise<JobApplication> => {
      const res = await api.patch(`/jobs/${id}`, { archived });
      return res.data;
    },
    onMutate: async (archived) => {
      await qc.cancelQueries({ queryKey: DETAIL_KEY(id) });
      const prev = qc.getQueryData<JobApplication>(DETAIL_KEY(id));
      if (prev) {
        qc.setQueryData<JobApplication>(DETAIL_KEY(id), {
          ...prev,
          archived,
        });
      }
      return { prev };
    },
    onError: (_err, _archived, ctx) => {
      if (ctx?.prev) qc.setQueryData(DETAIL_KEY(id), ctx.prev);
      toast.error('Could not change archive state');
    },
    onSuccess: (fresh) => {
      qc.setQueryData(DETAIL_KEY(id), fresh);
      qc.invalidateQueries({ queryKey: LIST_PREFIX });
    },
  });
}

export function useDeleteJob(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await api.delete(`/jobs/${id}`);
    },
    onSuccess: () => {
      qc.removeQueries({ queryKey: DETAIL_KEY(id) });
      qc.invalidateQueries({ queryKey: LIST_PREFIX });
    },
    onError: () => {
      toast.error('Could not delete application');
    },
  });
}

// ---- Round CRUD ----

export function useAddRound(jobId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateRoundBody): Promise<JobApplication> => {
      const res = await api.post(`/jobs/${jobId}/rounds`, body);
      return res.data;
    },
    onSuccess: (fresh) => {
      qc.setQueryData(DETAIL_KEY(jobId), fresh);
      qc.invalidateQueries({ queryKey: LIST_PREFIX });
    },
    onError: () => {
      toast.error('Could not add round');
    },
  });
}

export function useUpdateRound(jobId: string, roundId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: UpdateRoundBody): Promise<JobApplication> => {
      const res = await api.patch(`/jobs/${jobId}/rounds/${roundId}`, body);
      return res.data;
    },
    onMutate: async (body) => {
      // Optimize only outcome flips — the most frequent inline action.
      if (body.outcome === undefined) return {};
      await qc.cancelQueries({ queryKey: DETAIL_KEY(jobId) });
      const prev = qc.getQueryData<JobApplication>(DETAIL_KEY(jobId));
      if (!prev) return { prev };
      const next: JobApplication = {
        ...prev,
        rounds: prev.rounds.map((r) =>
          r._id === roundId ? { ...r, outcome: body.outcome as RoundOutcome } : r
        ),
      };
      qc.setQueryData(DETAIL_KEY(jobId), next);
      return { prev };
    },
    onError: (_err, _body, ctx) => {
      if (ctx?.prev) qc.setQueryData(DETAIL_KEY(jobId), ctx.prev);
      toast.error('Could not save round');
    },
    onSuccess: (fresh) => {
      qc.setQueryData(DETAIL_KEY(jobId), fresh);
      qc.invalidateQueries({ queryKey: LIST_PREFIX });
    },
  });
}

export function useDeleteRound(jobId: string, roundId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<JobApplication> => {
      const res = await api.delete(`/jobs/${jobId}/rounds/${roundId}`);
      return res.data;
    },
    onSuccess: (fresh) => {
      qc.setQueryData(DETAIL_KEY(jobId), fresh);
      qc.invalidateQueries({ queryKey: LIST_PREFIX });
    },
    onError: () => {
      toast.error('Could not delete round');
    },
  });
}

export function useReorderRounds(jobId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]): Promise<JobApplication> => {
      const res = await api.put(`/jobs/${jobId}/rounds/order`, { ids });
      return res.data;
    },
    onMutate: async (ids) => {
      await qc.cancelQueries({ queryKey: DETAIL_KEY(jobId) });
      const prev = qc.getQueryData<JobApplication>(DETAIL_KEY(jobId));
      if (prev && ids.length === prev.rounds.length) {
        const byId = new Map(prev.rounds.map((r) => [r._id, r]));
        if (ids.every((rid) => byId.has(rid))) {
          qc.setQueryData<JobApplication>(DETAIL_KEY(jobId), {
            ...prev,
            rounds: ids.map((rid) => byId.get(rid)!),
          });
        }
      }
      return { prev };
    },
    onError: (_err, _ids, ctx) => {
      if (ctx?.prev) qc.setQueryData(DETAIL_KEY(jobId), ctx.prev);
      toast.error('Could not save round order');
    },
    onSuccess: (fresh) => {
      qc.setQueryData(DETAIL_KEY(jobId), fresh);
    },
  });
}

// ---- Contact CRUD ----

export function useAddContact(jobId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateContactBody): Promise<JobApplication> => {
      const res = await api.post(`/jobs/${jobId}/contacts`, body);
      return res.data;
    },
    onSuccess: (fresh) => {
      qc.setQueryData(DETAIL_KEY(jobId), fresh);
      qc.invalidateQueries({ queryKey: LIST_PREFIX });
    },
    onError: () => {
      toast.error('Could not add contact');
    },
  });
}

export function useUpdateContact(jobId: string, contactId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: UpdateContactBody): Promise<JobApplication> => {
      const res = await api.patch(
        `/jobs/${jobId}/contacts/${contactId}`,
        body
      );
      return res.data;
    },
    onSuccess: (fresh) => {
      qc.setQueryData(DETAIL_KEY(jobId), fresh);
    },
    onError: () => {
      toast.error('Could not save contact');
    },
  });
}

export function useDeleteContact(jobId: string, contactId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<JobApplication> => {
      const res = await api.delete(`/jobs/${jobId}/contacts/${contactId}`);
      return res.data;
    },
    onSuccess: (fresh) => {
      qc.setQueryData(DETAIL_KEY(jobId), fresh);
    },
    onError: () => {
      toast.error('Could not delete contact');
    },
  });
}
```

- [ ] **Step 3: Build the web workspace**

Run: `npm -w @pathforge/web run build`

Expected: clean build. If TypeScript complains about an unused import, prune it; otherwise no edits.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/hooks/useJobs.ts
git commit -m "feat(web): job applications hooks

TanStack Query hooks for the /api/jobs surface: list + detail
reads with 404-as-null, full CRUD for applications, rounds, and
contacts. Optimistic updates on status flip, archive, round
outcome flip, and round reorder — same partial-optimistic shape
as useRoadmaps."
```

---

## Task 2 — Routes + navbar link

**Files:**
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/components/Navbar.tsx`

- [ ] **Step 1: [Read first] Skim the routing surface**

Read `apps/web/src/App.tsx` for the route table and `<Protected>`/`<RequireAuth>` wiring. Read `apps/web/src/components/Navbar.tsx` to see how the `Roadmaps` link is added.

- [ ] **Step 2: Register the three jobs routes in `App.tsx`**

Add imports at the top alongside the existing page imports:

```typescript
import { JobsListPage } from './pages/JobsListPage';
import { JobDetailPage } from './pages/JobDetailPage';
```

Add three routes inside the `<Routes>` block, grouped right after the existing roadmaps routes:

```tsx
<Route path="/jobs" element={<Protected><JobsListPage /></Protected>} />
<Route path="/jobs/archived" element={<Protected><JobsListPage archived /></Protected>} />
<Route path="/jobs/:id" element={<Protected><JobDetailPage /></Protected>} />
```

(`JobsListPage` and `JobDetailPage` are created in later tasks — for now these imports will fail. We add them here so the route table is in its final shape; tasks 3 and 6 satisfy the imports.)

- [ ] **Step 3: Add the "Jobs" link to the navbar**

In `apps/web/src/components/Navbar.tsx`, find the `<nav>` block that contains the `Roadmaps` link. Add a sibling `<Link>`:

```tsx
<Link
  to="/roadmaps"
  className="hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
>
  Roadmaps
</Link>
<Link
  to="/jobs"
  className="hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
>
  Jobs
</Link>
```

Match the existing className and ordering convention exactly.

- [ ] **Step 4: Stub the missing pages so the build passes for this commit**

The route registrations above import `JobsListPage` and `JobDetailPage` which don't exist yet. Create empty stubs so this task's commit type-checks:

`apps/web/src/pages/JobsListPage.tsx`:

```tsx
export function JobsListPage({ archived = false }: { archived?: boolean } = {}) {
  return <div className="p-10">Jobs list (archived={String(archived)}) — coming up.</div>;
}
```

`apps/web/src/pages/JobDetailPage.tsx`:

```tsx
export function JobDetailPage() {
  return <div className="p-10">Job detail — coming up.</div>;
}
```

These will be replaced wholesale in tasks 3 and 6.

- [ ] **Step 5: Verify build**

Run: `npm -w @pathforge/web run build`

Expected: clean. Navigating to `/jobs` should now render the stub.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/App.tsx apps/web/src/components/Navbar.tsx apps/web/src/pages/JobsListPage.tsx apps/web/src/pages/JobDetailPage.tsx
git commit -m "feat(web): register /jobs routes + navbar link

Stubs the list and detail pages so the route table type-checks;
real implementations come in subsequent commits."
```

---

## Task 3 — `JobsListPage` shell + status pills + empty/no-results

**Files:**
- Modify: `apps/web/src/pages/JobsListPage.tsx`
- Create: `apps/web/src/components/jobs/JobsListHeader.tsx`
- Create: `apps/web/src/components/jobs/JobsToolbar.tsx`
- Create: `apps/web/src/components/jobs/EmptyJobsState.tsx`
- Create: `apps/web/src/components/jobs/NoJobResultsState.tsx`

- [ ] **Step 1: [Read first] Mirror the sibling**

Read `apps/web/src/pages/RoadmapsListPage.tsx`, `apps/web/src/components/roadmaps/RoadmapsToolbar.tsx`, `apps/web/src/components/roadmaps/EmptyRoadmapsState.tsx`, `apps/web/src/components/roadmaps/NoResultsState.tsx`, and `apps/web/src/components/roadmaps/ListPageHeader.tsx`. Same shape — different copy and one new feature (status pills with counts).

- [ ] **Step 2: Create `JobsListHeader.tsx`**

```tsx
// apps/web/src/components/jobs/JobsListHeader.tsx
import { Button } from '../ui/button';

interface JobsListHeaderProps {
  archived: boolean;
  onNewClick: () => void;
}

export function JobsListHeader({ archived, onNewClick }: JobsListHeaderProps) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          {archived ? 'Archived applications' : 'Job applications'}
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          {archived
            ? 'Closed pursuits. Restore one any time.'
            : 'Track each application with its status, prep notes, questions asked, and post-interview reflection.'}
        </p>
      </div>
      {!archived && (
        <Button
          onClick={onNewClick}
          className="bg-brand text-white hover:bg-brand-hover shrink-0"
        >
          + New application
        </Button>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create `JobsToolbar.tsx` with status filter pills + search**

```tsx
// apps/web/src/components/jobs/JobsToolbar.tsx
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import type { JobApplicationStatus } from '@pathforge/shared';
import { cn } from '../../lib/utils';
import { Input } from '../ui/input';

export type StatusFilter = JobApplicationStatus | 'all';

const STATUS_ORDER: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'saved', label: 'Saved' },
  { value: 'applied', label: 'Applied' },
  { value: 'interviewing', label: 'Interview' },
  { value: 'offer', label: 'Offer' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'withdrawn', label: 'Withdrawn' },
];

interface JobsToolbarProps {
  archived: boolean;
  query: string;
  onQueryChange: (v: string) => void;
  statusFilter: StatusFilter;
  onStatusFilterChange: (v: StatusFilter) => void;
  counts: Record<StatusFilter, number>;
}

export function JobsToolbar({
  archived,
  query,
  onQueryChange,
  statusFilter,
  onStatusFilterChange,
  counts,
}: JobsToolbarProps) {
  return (
    <div className="mt-6 space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        {/* Active / Archive toggle */}
        <div className="relative inline-flex p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg">
          <Link
            to="/jobs"
            className={cn(
              'px-3.5 py-1.5 text-sm font-medium rounded-md transition-colors',
              !archived
                ? 'text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-900 shadow-sm'
                : 'text-slate-500 dark:text-slate-400'
            )}
          >
            Active
          </Link>
          <Link
            to="/jobs/archived"
            className={cn(
              'px-3.5 py-1.5 text-sm font-medium rounded-md transition-colors',
              archived
                ? 'text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-900 shadow-sm'
                : 'text-slate-500 dark:text-slate-400'
            )}
          >
            Archive
          </Link>
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
          <Input
            type="search"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search company, role, tags…"
            className="pl-9 bg-white dark:bg-slate-900"
          />
        </div>
      </div>

      {/* Status filter pills (active list only) */}
      {!archived && (
        <div className="flex flex-wrap gap-2">
          {STATUS_ORDER.map(({ value, label }) => {
            const active = statusFilter === value;
            const count = counts[value] ?? 0;
            return (
              <button
                key={value}
                type="button"
                onClick={() => onStatusFilterChange(value)}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium transition-colors border',
                  active
                    ? 'bg-slate-900 text-white border-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:border-slate-100'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-800 dark:hover:border-slate-700'
                )}
              >
                {label}
                <span
                  className={cn(
                    'text-xs font-normal',
                    active
                      ? 'text-slate-300 dark:text-slate-500'
                      : 'text-slate-400 dark:text-slate-500'
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Create `EmptyJobsState.tsx`**

```tsx
// apps/web/src/components/jobs/EmptyJobsState.tsx
import { Button } from '../ui/button';

interface EmptyJobsStateProps {
  archived: boolean;
  onNewClick?: () => void;
}

export function EmptyJobsState({ archived, onNewClick }: EmptyJobsStateProps) {
  return (
    <div className="mt-16 max-w-md">
      <h2 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
        {archived ? 'Nothing archived yet' : 'No applications yet'}
      </h2>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
        {archived
          ? 'Applications you archive will appear here. They stay searchable without cluttering your active pipeline.'
          : 'Track your first application — company, role, status, and the prep + reflection that goes around each interview round.'}
      </p>
      {!archived && onNewClick && (
        <Button
          onClick={onNewClick}
          className="mt-6 bg-brand text-white hover:bg-brand-hover"
        >
          + Track your first application
        </Button>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Create `NoJobResultsState.tsx`**

```tsx
// apps/web/src/components/jobs/NoJobResultsState.tsx
interface NoJobResultsStateProps {
  query: string;
  statusFilterLabel?: string;
}

export function NoJobResultsState({
  query,
  statusFilterLabel,
}: NoJobResultsStateProps) {
  const hasQuery = query.trim().length > 0;
  const hasFilter = !!statusFilterLabel && statusFilterLabel !== 'All';
  return (
    <div className="mt-16 max-w-md">
      <h2 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
        No matches
      </h2>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
        {hasQuery && hasFilter
          ? `No application matches "${query}" with status "${statusFilterLabel}". Try a shorter query or a different status.`
          : hasQuery
            ? `No application matches "${query}". Try a shorter query.`
            : hasFilter
              ? `No applications with status "${statusFilterLabel}".`
              : 'Try a different filter.'}
      </p>
    </div>
  );
}
```

- [ ] **Step 6: Replace the `JobsListPage.tsx` stub with the real shell**

```tsx
// apps/web/src/pages/JobsListPage.tsx
import { useMemo, useState } from 'react';
import { useJobs } from '../hooks/useJobs';
import { JobsListHeader } from '../components/jobs/JobsListHeader';
import { JobsToolbar, type StatusFilter } from '../components/jobs/JobsToolbar';
import { EmptyJobsState } from '../components/jobs/EmptyJobsState';
import { NoJobResultsState } from '../components/jobs/NoJobResultsState';

export function JobsListPage({ archived = false }: { archived?: boolean } = {}) {
  const { data, isPending } = useJobs({ archived });
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // Counts always reflect the unfiltered active set so the user can see
  // pipeline shape at a glance — they don't decrease as the user types.
  const counts = useMemo(() => {
    const c: Record<StatusFilter, number> = {
      all: 0,
      saved: 0,
      applied: 0,
      interviewing: 0,
      offer: 0,
      rejected: 0,
      withdrawn: 0,
    };
    if (!data) return c;
    c.all = data.length;
    for (const j of data) {
      c[j.status] = (c[j.status] ?? 0) + 1;
    }
    return c;
  }, [data]);

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    return data.filter((j) => {
      if (statusFilter !== 'all' && j.status !== statusFilter) return false;
      if (!q) return true;
      const hay = [
        j.company,
        j.role,
        ...j.tags,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [data, query, statusFilter]);

  const showEmpty = !isPending && (data?.length ?? 0) === 0;
  const showNoResults =
    !isPending && (data?.length ?? 0) > 0 && filtered.length === 0;
  const showList = !isPending && filtered.length > 0;

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="container max-w-6xl py-10 px-6">
        <JobsListHeader
          archived={archived}
          onNewClick={() => {
            // NewJobDialog wiring lands in Task 5; placeholder for now.
            console.log('open new job dialog');
          }}
        />

        <JobsToolbar
          archived={archived}
          query={query}
          onQueryChange={setQuery}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          counts={counts}
        />

        {isPending && (
          <p className="mt-10 text-sm text-slate-500 dark:text-slate-400">
            Loading…
          </p>
        )}

        {showEmpty && (
          <EmptyJobsState
            archived={archived}
            onNewClick={() => console.log('open new job dialog')}
          />
        )}

        {showNoResults && (
          <NoJobResultsState
            query={query}
            statusFilterLabel={statusFilter === 'all' ? undefined : statusFilter}
          />
        )}

        {showList && (
          <div className="mt-6 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900">
            {/* JobListRow rendering lands in Task 4 */}
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.map((j) => (
                <li
                  key={j._id}
                  className="px-5 py-4 text-sm text-slate-700 dark:text-slate-300"
                >
                  <span className="font-medium text-slate-900 dark:text-slate-100">
                    {j.company}
                  </span>{' '}
                  · {j.role} ·{' '}
                  <span className="text-slate-500 dark:text-slate-400">
                    {j.status}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </main>
  );
}
```

The list renderer is a plain `<ul>` for now; Task 4 swaps in `JobListRow`.

- [ ] **Step 7: Verify build**

Run: `npm -w @pathforge/web run build`

Expected: clean. Navigate to `/jobs` in the dev server (`npm -w @pathforge/web run dev`) to confirm header, toolbar with empty status pills, and `Loading…` (or empty state if there are zero apps in the DB).

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/pages/JobsListPage.tsx apps/web/src/components/jobs/JobsListHeader.tsx apps/web/src/components/jobs/JobsToolbar.tsx apps/web/src/components/jobs/EmptyJobsState.tsx apps/web/src/components/jobs/NoJobResultsState.tsx
git commit -m "feat(web): jobs list page shell + status filter pills

Header, Active/Archive toggle, status pills with counts derived
from the unfiltered set, and the two empty states (no apps yet /
no matches). Row rendering is a placeholder; the real card-style
row lands in the next commit."
```

---

## Task 4 — `JobListRow` (card-style row)

**Files:**
- Create: `apps/web/src/components/jobs/JobListRow.tsx`
- Create: `apps/web/src/lib/jobs-formatting.ts`
- Modify: `apps/web/src/pages/JobsListPage.tsx`

The row corresponds to the approved mockup: avatar logo · company · role · tags · meta line (work mode · location · salary · resume version · contact count) · highlighted status pill (with `Round N of M`) · highlighted date chip · last-updated stamp.

- [ ] **Step 1: [Read first] Sibling card for reference**

Read `apps/web/src/components/roadmaps/RoadmapCard.tsx` for the avatar-icon-box gradient convention and the dark-mode styling pattern.

- [ ] **Step 2: Create the formatting helpers**

```typescript
// apps/web/src/lib/jobs-formatting.ts
import type { JobApplication, JobApplicationStatus } from '@pathforge/shared';

const STATUS_CLASS: Record<JobApplicationStatus, string> = {
  saved:
    'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  applied:
    'bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300',
  interviewing:
    'bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300',
  offer:
    'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300',
  rejected:
    'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300',
  withdrawn:
    'bg-slate-200 text-slate-600 dark:bg-slate-900 dark:text-slate-500',
};

const STATUS_LABEL: Record<JobApplicationStatus, string> = {
  saved: 'Saved',
  applied: 'Applied',
  interviewing: 'Interview',
  offer: 'Offer',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
};

export function statusClass(s: JobApplicationStatus) {
  return STATUS_CLASS[s];
}

export function statusLabel(s: JobApplicationStatus) {
  return STATUS_LABEL[s];
}

/**
 * Compute "Round N of M" for the status block.
 * M = rounds.length.
 * N = index of the first round whose outcome is not 'passed' (1-indexed).
 * Returns null when there are no rounds, or every round is passed.
 */
export function roundProgress(job: JobApplication): { n: number; m: number } | null {
  const m = job.rounds.length;
  if (m === 0) return null;
  const idx = job.rounds.findIndex((r) => r.outcome !== 'passed');
  if (idx === -1) return null;
  return { n: idx + 1, m };
}

/**
 * Derive a display-friendly filename from a resume URL.
 * E.g. https://docs.google.com/.../resume-swe-v3.pdf  →  "resume-swe-v3.pdf"
 * Falls back to the host when the URL has no path segment.
 */
export function resumeLabel(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const last = u.pathname.split('/').filter(Boolean).pop();
    return last ? decodeURIComponent(last) : u.host;
  } catch {
    return null;
  }
}

/**
 * Short relative time: "2d ago", "5h ago", "just now", "Mar 14, 2026" for >30 days.
 */
export function relativeTime(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.round(diffMs / 60_000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.round(diffH / 24);
  if (diffD < 30) return `${diffD}d ago`;
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * "Applied Mar 14" — contextual date label keyed by status.
 * For `saved` apps, prefers `createdAt` over `appliedAt` (the latter is usually undefined).
 */
export function statusDateChip(job: JobApplication): { prefix: string; date: Date } {
  switch (job.status) {
    case 'saved':
      return { prefix: 'Saved', date: new Date(job.createdAt) };
    case 'rejected':
    case 'withdrawn':
      return {
        prefix: 'Closed',
        date: new Date(job.updatedAt),
      };
    default:
      return {
        prefix: 'Applied',
        date: new Date(job.appliedAt ?? job.createdAt),
      };
  }
}

export function formatMonthDay(d: Date): string {
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/**
 * Initials for the logo box: first two non-space characters of the company name,
 * uppercased. Falls back to `?` for an empty company (should not happen).
 */
export function companyInitial(company: string): string {
  const cleaned = company.trim();
  if (cleaned.length === 0) return '?';
  return cleaned.charAt(0).toUpperCase();
}

/**
 * Pick a stable gradient palette for the logo box based on the app id.
 * Mirrors the palette idea from RoadmapCard, narrowed to a set that pairs
 * well with the row's highlight colors.
 */
const PALETTE = [
  'from-indigo-500 to-violet-600',
  'from-sky-500 to-cyan-600',
  'from-emerald-500 to-teal-600',
  'from-amber-500 to-orange-600',
  'from-rose-500 to-pink-600',
  'from-slate-700 to-slate-900',
];

export function paletteFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  const idx = Math.abs(hash) % PALETTE.length;
  return PALETTE[idx];
}
```

- [ ] **Step 3: Create `JobListRow.tsx`**

```tsx
// apps/web/src/components/jobs/JobListRow.tsx
import { Link } from 'react-router-dom';
import { Calendar, Globe, MapPin } from 'lucide-react';
import type { JobApplication } from '@pathforge/shared';
import { cn } from '../../lib/utils';
import {
  companyInitial,
  formatMonthDay,
  paletteFor,
  relativeTime,
  resumeLabel,
  roundProgress,
  statusClass,
  statusDateChip,
  statusLabel,
} from '../../lib/jobs-formatting';

interface JobListRowProps {
  job: JobApplication;
}

export function JobListRow({ job }: JobListRowProps) {
  const progress = roundProgress(job);
  const resume = resumeLabel(job.resumeUrl);
  const { prefix, date } = statusDateChip(job);
  const palette = paletteFor(job._id);
  const modeIcon =
    job.workMode === 'onsite' ? MapPin : Globe;
  const ModeIcon = modeIcon;

  return (
    <Link
      to={`/jobs/${job._id}`}
      className="group block hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
    >
      <div className="grid grid-cols-[56px_1fr_220px] gap-4 px-5 py-4 items-center">
        {/* Logo */}
        <div
          className={cn(
            'h-12 w-12 rounded-xl flex items-center justify-center text-white text-lg font-bold bg-gradient-to-br shrink-0',
            palette
          )}
        >
          {companyInitial(job.company)}
        </div>

        {/* Main */}
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="font-semibold text-[15px] text-slate-900 dark:text-slate-100 truncate">
              {job.company}
            </span>
            <span className="text-slate-500 dark:text-slate-400 text-sm truncate">
              · {job.role}
            </span>
          </div>

          {job.tags.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {job.tags.slice(0, 6).map((t) => (
                <span
                  key={t}
                  className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[11px] font-medium px-2 py-0.5 rounded-full"
                >
                  {t}
                </span>
              ))}
              {job.tags.length > 6 && (
                <span className="text-[11px] text-slate-400 dark:text-slate-500">
                  +{job.tags.length - 6}
                </span>
              )}
            </div>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px] text-slate-500 dark:text-slate-400">
            {job.workMode && (
              <span className="inline-flex items-center gap-1">
                <ModeIcon className="h-3 w-3 opacity-70" />
                {job.workMode === 'onsite' && job.location
                  ? `Onsite · ${job.location}`
                  : job.workMode === 'hybrid' && job.location
                    ? `Hybrid · ${job.location}`
                    : job.workMode === 'remote'
                      ? 'Remote'
                      : job.workMode}
              </span>
            )}
            {!job.workMode && job.location && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3 opacity-70" />
                {job.location}
              </span>
            )}
            {job.salaryRange && (
              <>
                <Dot />
                <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                  {job.salaryRange}
                </span>
              </>
            )}
            {job.offerAmount && job.status === 'offer' && (
              <>
                <Dot />
                <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                  Offer · {job.offerAmount}
                </span>
              </>
            )}
            {resume && (
              <>
                <Dot />
                <span className="font-mono text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-1.5 py-0.5 rounded">
                  {resume}
                </span>
              </>
            )}
            {job.contacts.length > 0 && (
              <>
                <Dot />
                <span>
                  {job.contacts.length}{' '}
                  {job.contacts.length === 1 ? 'contact' : 'contacts'}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Right */}
        <div className="flex flex-col items-end gap-1.5">
          <span
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[13px] font-semibold',
              statusClass(job.status)
            )}
          >
            {statusLabel(job.status)}
            {progress && job.status === 'interviewing' && (
              <span className="text-[11px] font-medium opacity-70 border-l border-current/40 pl-1.5">
                Round {progress.n} of {progress.m}
              </span>
            )}
          </span>

          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900 text-[12px] font-semibold">
            <Calendar className="h-3 w-3" />
            {prefix} {formatMonthDay(date)}
          </span>

          <span className="text-[11px] text-slate-400 dark:text-slate-500">
            Updated {relativeTime(job.updatedAt)}
          </span>
        </div>
      </div>
    </Link>
  );
}

function Dot() {
  return (
    <span
      aria-hidden
      className="inline-block h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-600"
    />
  );
}
```

- [ ] **Step 4: Wire `JobListRow` into `JobsListPage`**

Replace the placeholder `<ul>` block from Task 3 in `apps/web/src/pages/JobsListPage.tsx`:

```tsx
import { JobListRow } from '../components/jobs/JobListRow';

// …inside the page, replace the placeholder list block with:

{showList && (
  <div className="mt-6 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800">
    {filtered.map((j) => (
      <JobListRow key={j._id} job={j} />
    ))}
  </div>
)}
```

- [ ] **Step 5: Verify build**

Run: `npm -w @pathforge/web run build`

Expected: clean. With at least one job application in the DB (you can `POST /api/jobs` via curl), the list page should render the row with logo, status pill, date chip, and update stamp.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/jobs/JobListRow.tsx apps/web/src/lib/jobs-formatting.ts apps/web/src/pages/JobsListPage.tsx
git commit -m "feat(web): card-style JobListRow

Status pill + Round N of M derived indicator + amber date chip +
salary/resume/contacts meta line + gradient logo box, all keyed
off the spec's approved mockup. Adds jobs-formatting.ts with the
small derived-value helpers (roundProgress, resumeLabel, status
labels, palette)."
```

---

## Task 5 — `NewJobDialog` (create flow)

**Files:**
- Create: `apps/web/src/components/jobs/NewJobDialog.tsx`
- Modify: `apps/web/src/pages/JobsListPage.tsx`

- [ ] **Step 1: [Read first] Sibling dialog**

Read `apps/web/src/components/roadmaps/NewRoadmapDialog.tsx` — the exact pattern (state, Dialog + DialogFooter, optional date via Popover + Calendar, ghost cancel + branded submit).

- [ ] **Step 2: Create `NewJobDialog.tsx`**

```tsx
// apps/web/src/components/jobs/NewJobDialog.tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';
import type { JobApplicationStatus, WorkMode } from '@pathforge/shared';
import { useCreateJob } from '../../hooks/useJobs';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Calendar } from '../ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';

interface NewJobDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const STATUSES: JobApplicationStatus[] = [
  'saved',
  'applied',
  'interviewing',
  'offer',
  'rejected',
  'withdrawn',
];

const STATUS_LABEL: Record<JobApplicationStatus, string> = {
  saved: 'Saved',
  applied: 'Applied',
  interviewing: 'Interviewing',
  offer: 'Offer',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
};

export function NewJobDialog({ open, onOpenChange }: NewJobDialogProps) {
  const navigate = useNavigate();
  const create = useCreateJob();

  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState<JobApplicationStatus>('saved');
  const [appliedAt, setAppliedAt] = useState<Date | undefined>(undefined);
  const [appliedAtOpen, setAppliedAtOpen] = useState(false);
  const [jobUrl, setJobUrl] = useState('');
  const [resumeUrl, setResumeUrl] = useState('');
  const [workMode, setWorkMode] = useState<WorkMode | ''>('');
  const [location, setLocation] = useState('');
  const [salaryRange, setSalaryRange] = useState('');
  const [tags, setTags] = useState('');
  const [notes, setNotes] = useState('');

  // Reset whenever the dialog opens
  useEffect(() => {
    if (open) {
      setCompany('');
      setRole('');
      setStatus('saved');
      setAppliedAt(undefined);
      setJobUrl('');
      setResumeUrl('');
      setWorkMode('');
      setLocation('');
      setSalaryRange('');
      setTags('');
      setNotes('');
    }
  }, [open]);

  const submit = () => {
    if (!company.trim() || !role.trim()) return;
    create.mutate(
      {
        company: company.trim(),
        role: role.trim(),
        status,
        appliedAt,
        jobUrl: jobUrl.trim() || undefined,
        resumeUrl: resumeUrl.trim() || undefined,
        workMode: workMode || undefined,
        location: location.trim() || undefined,
        salaryRange: salaryRange.trim() || undefined,
        tags: tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        notes: notes.trim() || undefined,
      },
      {
        onSuccess: (fresh) => {
          onOpenChange(false);
          navigate(`/jobs/${fresh._id}`);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold tracking-tight">
            New application
          </DialogTitle>
          <DialogDescription>
            Company and role are required. Everything else is optional and can
            be filled in later from the detail page.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <Field label="Company">
            <Input
              autoFocus
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="e.g. Linear"
            />
          </Field>

          <Field label="Role">
            <Input
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="e.g. Senior Software Engineer"
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Status">
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as JobApplicationStatus)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Applied on" optional>
              <Popover open={appliedAtOpen} onOpenChange={setAppliedAtOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="w-full inline-flex items-center justify-between px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
                  >
                    {appliedAt ? (
                      format(appliedAt, 'MMM d, yyyy')
                    ) : (
                      <span className="text-slate-400 dark:text-slate-500">
                        Pick a date
                      </span>
                    )}
                    <CalendarIcon className="h-3.5 w-3.5 text-slate-400" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={appliedAt}
                    onSelect={(d) => {
                      setAppliedAt(d);
                      setAppliedAtOpen(false);
                    }}
                    autoFocus
                  />
                </PopoverContent>
              </Popover>
            </Field>
          </div>

          <Field label="Job posting URL" optional>
            <Input
              type="url"
              value={jobUrl}
              onChange={(e) => setJobUrl(e.target.value)}
              placeholder="https://"
            />
          </Field>

          <Field label="Resume URL" optional>
            <Input
              type="url"
              value={resumeUrl}
              onChange={(e) => setResumeUrl(e.target.value)}
              placeholder="https://drive.google.com/…"
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Work mode" optional>
              <Select
                value={workMode}
                onValueChange={(v) => setWorkMode(v as WorkMode)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="remote">Remote</SelectItem>
                  <SelectItem value="hybrid">Hybrid</SelectItem>
                  <SelectItem value="onsite">Onsite</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field label="Location" optional>
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. NYC"
              />
            </Field>
          </div>

          <Field label="Salary range" optional>
            <Input
              value={salaryRange}
              onChange={(e) => setSalaryRange(e.target.value)}
              placeholder="e.g. $180k – $220k"
            />
          </Field>

          <Field label="Tags" optional hint="Comma-separated.">
            <Input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="react, remote, referral"
            />
          </Field>

          <Field label="Notes" optional>
            <Textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything you want to remember about the role."
            />
          </Field>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={!company.trim() || !role.trim() || create.isPending}
            className="bg-brand text-white hover:bg-brand-hover"
          >
            {create.isPending ? 'Creating…' : 'Create application'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  optional,
  hint,
  children,
}: {
  label: string;
  optional?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
        {label}
        {optional && (
          <span className="text-slate-400 dark:text-slate-500 font-normal">
            {' '}
            (optional)
          </span>
        )}
        {hint && (
          <span className="text-slate-400 dark:text-slate-500 font-normal">
            {' '}
            — {hint}
          </span>
        )}
      </label>
      {children}
    </div>
  );
}
```

- [ ] **Step 3: Wire the dialog into `JobsListPage`**

In `apps/web/src/pages/JobsListPage.tsx`:

```tsx
// Add import:
import { NewJobDialog } from '../components/jobs/NewJobDialog';

// Replace the placeholder onNewClick console.logs with real state:
const [newDialogOpen, setNewDialogOpen] = useState(false);

// Pass onNewClick={() => setNewDialogOpen(true)} to JobsListHeader and EmptyJobsState.

// Mount the dialog at the end of the page JSX, before </main>:
<NewJobDialog open={newDialogOpen} onOpenChange={setNewDialogOpen} />
```

- [ ] **Step 4: Verify build + manual smoke**

Run: `npm -w @pathforge/web run build`. Then in the dev server: open `/jobs`, click "+ New application", fill in company + role, submit → page navigates to `/jobs/:id` (which still shows the stub from Task 2; replaced in Task 6).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/jobs/NewJobDialog.tsx apps/web/src/pages/JobsListPage.tsx
git commit -m "feat(web): NewJobDialog create flow

Multi-field create form with required company/role and optional
status, applied-on, job/resume URLs, mode + location, salary,
tags, and notes. Submit navigates to the freshly created
application's detail page."
```

---

## Task 6 — `JobDetailPage` shell + `JobDetailSidebar` skeleton + `JobIdentityHero`

**Files:**
- Modify: `apps/web/src/pages/JobDetailPage.tsx`
- Create: `apps/web/src/components/jobs/JobDetailSidebar.tsx`
- Create: `apps/web/src/components/jobs/JobIdentityHero.tsx`

- [ ] **Step 1: [Read first] Sibling detail**

Read `apps/web/src/pages/RoadmapDetailPage.tsx` and `apps/web/src/components/roadmaps/RoadmapSidebar.tsx`. The layout (two-column with `lg:sticky` sidebar) and the back-link / identity / actions split.

- [ ] **Step 2: Create `JobIdentityHero.tsx`**

```tsx
// apps/web/src/components/jobs/JobIdentityHero.tsx
import type { JobApplication } from '@pathforge/shared';
import { cn } from '../../lib/utils';
import { companyInitial, paletteFor } from '../../lib/jobs-formatting';

interface JobIdentityHeroProps {
  job: JobApplication;
}

export function JobIdentityHero({ job }: JobIdentityHeroProps) {
  const palette = paletteFor(job._id);
  return (
    <div>
      <div
        className={cn(
          'h-14 w-14 rounded-2xl flex items-center justify-center text-white text-2xl font-bold bg-gradient-to-br',
          palette
        )}
      >
        {companyInitial(job.company)}
      </div>
      <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 break-words">
        {job.company}
      </h1>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        {job.role}
      </p>
    </div>
  );
}
```

- [ ] **Step 3: Create `JobDetailSidebar.tsx` skeleton**

```tsx
// apps/web/src/components/jobs/JobDetailSidebar.tsx
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import type { JobApplication } from '@pathforge/shared';
import { JobIdentityHero } from './JobIdentityHero';

interface JobDetailSidebarProps {
  job: JobApplication;
}

export function JobDetailSidebar({ job }: JobDetailSidebarProps) {
  return (
    <aside className="w-full lg:w-[320px] lg:shrink-0 lg:sticky lg:top-20 lg:self-start space-y-6">
      <Link
        to={job.archived ? '/jobs/archived' : '/jobs'}
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {job.archived ? 'Archive' : 'Applications'}
      </Link>

      <JobIdentityHero job={job} />

      {/* StatusBlock, QuickFactsBlock, TagsBlock, LinkedRoadmapBlock, ContactsBlock, JobActions are added in tasks 7-12 */}
    </aside>
  );
}
```

- [ ] **Step 4: Replace the `JobDetailPage.tsx` stub**

```tsx
// apps/web/src/pages/JobDetailPage.tsx
import { useParams } from 'react-router-dom';
import { useJob } from '../hooks/useJobs';
import { JobDetailSidebar } from '../components/jobs/JobDetailSidebar';
import { NotFoundPanel } from '../components/NotFoundPanel';

export function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isPending } = useJob(id);

  if (isPending) {
    return (
      <main className="min-h-screen bg-slate-50 dark:bg-slate-950">
        <div className="container max-w-6xl py-10 px-6">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Loading…
          </p>
        </div>
      </main>
    );
  }

  if (!data) {
    return <NotFoundPanel kind="application" backHref="/jobs" />;
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-white via-slate-50 to-slate-50 dark:from-slate-950 dark:via-slate-950 dark:to-slate-950">
      <div className="container max-w-6xl py-10 px-6">
        <div className="flex flex-col lg:flex-row gap-10">
          <JobDetailSidebar job={data} />
          <section className="flex-1 min-w-0 space-y-6">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Application notes
              </h3>
              <p className="mt-2 text-sm text-slate-400 dark:text-slate-500 italic">
                Notes panel will land in Task 13.
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Interview rounds
              </h3>
              <p className="mt-2 text-sm text-slate-400 dark:text-slate-500 italic">
                Rounds panel will land in Tasks 14–17.
              </p>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
```

`NotFoundPanel` already exists at `apps/web/src/components/NotFoundPanel.tsx`. If it doesn't accept a `kind` prop, peek at its current signature first; the roadmap detail page uses it with the prop set to `'roadmap'`. If the prop is different (`label`, `entity`, etc.), match that name.

- [ ] **Step 5: Verify build**

Run: `npm -w @pathforge/web run build`

Expected: clean. Navigate to `/jobs/:id` in the dev server (use an existing app's id from `/jobs` or create one via the dialog). You should see the back link, company hero, and placeholder right-column panels.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/pages/JobDetailPage.tsx apps/web/src/components/jobs/JobDetailSidebar.tsx apps/web/src/components/jobs/JobIdentityHero.tsx
git commit -m "feat(web): job detail page shell + identity hero

Two-column sidebar layout with back link and company/role hero;
right column has placeholder panels for notes and rounds. Real
content lands in tasks 7-17."
```

---

## Task 7 — `StatusBlock` (status picker + Round N of M)

**Files:**
- Create: `apps/web/src/components/jobs/StatusBlock.tsx`
- Modify: `apps/web/src/components/jobs/JobDetailSidebar.tsx`

- [ ] **Step 1: Create `StatusBlock.tsx`**

```tsx
// apps/web/src/components/jobs/StatusBlock.tsx
import { ChevronDown } from 'lucide-react';
import type {
  JobApplication,
  JobApplicationStatus,
} from '@pathforge/shared';
import { cn } from '../../lib/utils';
import { useUpdateJob } from '../../hooks/useJobs';
import {
  roundProgress,
  statusClass,
  statusLabel,
} from '../../lib/jobs-formatting';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';

interface StatusBlockProps {
  job: JobApplication;
}

const STATUSES: JobApplicationStatus[] = [
  'saved',
  'applied',
  'interviewing',
  'offer',
  'rejected',
  'withdrawn',
];

export function StatusBlock({ job }: StatusBlockProps) {
  const update = useUpdateJob(job._id);
  const progress = roundProgress(job);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            'w-full flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-opacity hover:opacity-90',
            statusClass(job.status)
          )}
        >
          <span className="flex items-center gap-2">
            {statusLabel(job.status)}
            {progress && job.status === 'interviewing' && (
              <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-white/40 dark:bg-black/20">
                Round {progress.n} of {progress.m}
              </span>
            )}
          </span>
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {STATUSES.map((s) => (
          <DropdownMenuItem
            key={s}
            onSelect={() => {
              if (s !== job.status) update.mutate({ status: s });
            }}
            className={cn(s === job.status && 'font-semibold')}
          >
            {statusLabel(s)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

- [ ] **Step 2: Wire into the sidebar**

In `apps/web/src/components/jobs/JobDetailSidebar.tsx`, add the import and render the block under the identity hero:

```tsx
import { StatusBlock } from './StatusBlock';

// inside <aside>, after <JobIdentityHero job={job} />:
<StatusBlock job={job} />
```

- [ ] **Step 3: Verify build + click through**

Run: `npm -w @pathforge/web run build`. In the dev server, change the status from the sidebar dropdown — the pill colour updates and the change persists across page reloads. If the job has rounds and is `interviewing`, the `Round N of M` sub-label is visible.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/jobs/StatusBlock.tsx apps/web/src/components/jobs/JobDetailSidebar.tsx
git commit -m "feat(web): StatusBlock with status picker + Round N of M

Big tinted pill that doubles as a dropdown trigger. Status flips
are PATCH /api/jobs/:id calls via useUpdateJob. The 'Round N of M'
indicator is derived in jobs-formatting.ts and hides automatically
when there are no rounds or every round is passed."
```

---

## Task 8 — `QuickFactsBlock` (dates, mode, salary, links, resume)

**Files:**
- Create: `apps/web/src/components/jobs/QuickFactsBlock.tsx`
- Modify: `apps/web/src/components/jobs/JobDetailSidebar.tsx`

- [ ] **Step 1: Create `QuickFactsBlock.tsx`**

```tsx
// apps/web/src/components/jobs/QuickFactsBlock.tsx
import { Calendar, DollarSign, FileText, Globe, Link as LinkIcon, MapPin } from 'lucide-react';
import type { JobApplication } from '@pathforge/shared';
import { resumeLabel } from '../../lib/jobs-formatting';

interface QuickFactsBlockProps {
  job: JobApplication;
}

export function QuickFactsBlock({ job }: QuickFactsBlockProps) {
  const items: Array<{
    icon: typeof Calendar;
    label: string;
    value: React.ReactNode;
  }> = [];

  if (job.appliedAt) {
    items.push({
      icon: Calendar,
      label: 'Applied',
      value: new Date(job.appliedAt).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
    });
  }

  if (job.workMode || job.location) {
    items.push({
      icon: job.workMode === 'onsite' ? MapPin : Globe,
      label: 'Mode',
      value: [
        job.workMode === 'remote'
          ? 'Remote'
          : job.workMode === 'hybrid'
            ? 'Hybrid'
            : job.workMode === 'onsite'
              ? 'Onsite'
              : null,
        job.location,
      ]
        .filter(Boolean)
        .join(' · '),
    });
  }

  if (job.salaryRange) {
    items.push({
      icon: DollarSign,
      label: 'Salary',
      value: (
        <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
          {job.salaryRange}
        </span>
      ),
    });
  }
  if (job.offerAmount && job.status === 'offer') {
    items.push({
      icon: DollarSign,
      label: 'Offer',
      value: (
        <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
          {job.offerAmount}
        </span>
      ),
    });
  }

  if (job.jobUrl) {
    items.push({
      icon: LinkIcon,
      label: 'Job posting',
      value: (
        <a
          href={job.jobUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sky-700 dark:text-sky-400 hover:underline truncate inline-block max-w-[180px]"
        >
          {new URL(job.jobUrl).host} ↗
        </a>
      ),
    });
  }

  if (job.resumeUrl) {
    items.push({
      icon: FileText,
      label: 'Resume',
      value: (
        <a
          href={job.resumeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-1.5 py-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
        >
          {resumeLabel(job.resumeUrl)} ↗
        </a>
      ),
    });
  }

  if (items.length === 0) return null;

  return (
    <div className="border-t border-slate-200 dark:border-slate-800 pt-4">
      <div className="space-y-2.5">
        {items.map(({ icon: Icon, label, value }, i) => (
          <div
            key={i}
            className="flex items-center justify-between gap-3 text-sm"
          >
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <Icon className="h-3 w-3 opacity-70" />
              {label}
            </span>
            <span className="text-slate-900 dark:text-slate-100 text-right truncate">
              {value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire into the sidebar**

In `JobDetailSidebar.tsx`, add the import and render below `StatusBlock`:

```tsx
import { QuickFactsBlock } from './QuickFactsBlock';

<QuickFactsBlock job={job} />
```

- [ ] **Step 3: Verify build**

Run: `npm -w @pathforge/web run build`. In the dev server the quick-facts list should appear under the status block, hiding rows that have no value.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/jobs/QuickFactsBlock.tsx apps/web/src/components/jobs/JobDetailSidebar.tsx
git commit -m "feat(web): QuickFactsBlock for sidebar

Applied date · mode · location · salary · job URL · resume URL.
Each row hides when its value is missing; salary is highlighted
in emerald; resume URL is shown as a monospace filename chip
derived from the URL's last path segment."
```

---

## Task 9 — `TagsBlock` (inline add/remove)

**Files:**
- Create: `apps/web/src/components/jobs/TagsBlock.tsx`
- Modify: `apps/web/src/components/jobs/JobDetailSidebar.tsx`

- [ ] **Step 1: Create `TagsBlock.tsx`**

```tsx
// apps/web/src/components/jobs/TagsBlock.tsx
import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import type { JobApplication } from '@pathforge/shared';
import { useUpdateJob } from '../../hooks/useJobs';

interface TagsBlockProps {
  job: JobApplication;
}

export function TagsBlock({ job }: TagsBlockProps) {
  const update = useUpdateJob(job._id);
  const [adding, setAdding] = useState(false);
  const [value, setValue] = useState('');

  const addTag = () => {
    const t = value.trim().toLowerCase();
    if (!t) {
      setAdding(false);
      setValue('');
      return;
    }
    if (job.tags.includes(t)) {
      setValue('');
      setAdding(false);
      return;
    }
    update.mutate({ tags: [...job.tags, t] });
    setValue('');
    setAdding(false);
  };

  const removeTag = (tag: string) => {
    update.mutate({ tags: job.tags.filter((t) => t !== tag) });
  };

  return (
    <div className="border-t border-slate-200 dark:border-slate-800 pt-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Tags
        </h3>
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
          >
            <Plus className="h-3 w-3" />
            Add
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {job.tags.map((t) => (
          <span
            key={t}
            className="group inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium px-2 py-0.5 rounded-full"
          >
            {t}
            <button
              type="button"
              onClick={() => removeTag(t)}
              className="opacity-50 hover:opacity-100 transition-opacity"
              aria-label={`Remove ${t}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        {job.tags.length === 0 && !adding && (
          <span className="text-xs text-slate-400 dark:text-slate-500 italic">
            No tags yet
          </span>
        )}
        {adding && (
          <input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={addTag}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addTag();
              } else if (e.key === 'Escape') {
                setValue('');
                setAdding(false);
              }
            }}
            placeholder="tag…"
            className="bg-transparent border-b border-slate-300 dark:border-slate-700 text-xs px-1 py-0.5 outline-none focus:border-slate-500 dark:focus:border-slate-400 min-w-[60px] max-w-[120px]"
          />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire into the sidebar**

```tsx
import { TagsBlock } from './TagsBlock';

<TagsBlock job={job} />
```

- [ ] **Step 3: Verify build + click through**

Build cleanly; in the dev server, click "Add", type "react", press Enter — the tag persists. Click the `X` next to it to remove.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/jobs/TagsBlock.tsx apps/web/src/components/jobs/JobDetailSidebar.tsx
git commit -m "feat(web): TagsBlock inline add/remove

Click Add to type a tag; Enter or blur saves; Escape cancels.
Each tag has a small X to remove. PATCH /api/jobs/:id with the
new tags array."
```

---

## Task 10 — `LinkedRoadmapBlock` + roadmap typeahead helper

**Files:**
- Create: `apps/web/src/components/jobs/LinkedRoadmapBlock.tsx`
- Create: `apps/web/src/components/jobs/LinkedRoadmapPicker.tsx`
- Modify: `apps/web/src/components/jobs/JobDetailSidebar.tsx`

The picker is built ahead of the edit dialog (Task 12) so it can be reused there too.

- [ ] **Step 1: [Read first] Existing roadmaps hook**

Confirm `useRoadmaps({ archived: false })` exists in `apps/web/src/hooks/useRoadmaps.ts` — the picker uses it.

- [ ] **Step 2: Create `LinkedRoadmapPicker.tsx`**

```tsx
// apps/web/src/components/jobs/LinkedRoadmapPicker.tsx
import { useMemo, useState } from 'react';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import type { Roadmap } from '@pathforge/shared';
import { cn } from '../../lib/utils';
import { useRoadmaps } from '../../hooks/useRoadmaps';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../ui/popover';
import { Input } from '../ui/input';

interface LinkedRoadmapPickerProps {
  value: string | undefined;
  onChange: (roadmapId: string | undefined) => void;
}

export function LinkedRoadmapPicker({
  value,
  onChange,
}: LinkedRoadmapPickerProps) {
  const { data: roadmaps } = useRoadmaps({ archived: false });
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selected = useMemo(
    () => roadmaps?.find((r) => r._id === value),
    [roadmaps, value]
  );

  const filtered: Roadmap[] = useMemo(() => {
    if (!roadmaps) return [];
    const q = query.trim().toLowerCase();
    if (!q) return roadmaps;
    return roadmaps.filter((r) =>
      r.title.toLowerCase().includes(q)
    );
  }, [roadmaps, query]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="w-full inline-flex items-center justify-between px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
        >
          <span
            className={cn(
              'truncate',
              !selected && 'text-slate-400 dark:text-slate-500'
            )}
          >
            {selected ? selected.title : 'No roadmap linked'}
          </span>
          <span className="flex items-center gap-1">
            {selected && (
              <span
                role="button"
                tabIndex={0}
                aria-label="Clear linked roadmap"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(undefined);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    e.stopPropagation();
                    onChange(undefined);
                  }
                }}
                className="text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-300"
              >
                <X className="h-3.5 w-3.5" />
              </span>
            )}
            <ChevronsUpDown className="h-3.5 w-3.5 text-slate-400" />
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[280px]" align="start">
        <div className="p-2 border-b border-slate-200 dark:border-slate-800">
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search roadmaps…"
            className="h-8 text-sm"
          />
        </div>
        <div className="max-h-64 overflow-y-auto py-1">
          {filtered.length === 0 && (
            <p className="px-3 py-2 text-xs text-slate-400">No matches.</p>
          )}
          {filtered.map((r) => (
            <button
              type="button"
              key={r._id}
              onClick={() => {
                onChange(r._id);
                setOpen(false);
              }}
              className="w-full flex items-center justify-between gap-2 px-3 py-1.5 text-sm text-left hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <span className="truncate">{r.title}</span>
              {r._id === value && (
                <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              )}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
```

- [ ] **Step 3: Create `LinkedRoadmapBlock.tsx`**

```tsx
// apps/web/src/components/jobs/LinkedRoadmapBlock.tsx
import { Link } from 'react-router-dom';
import { ArrowRight, Compass } from 'lucide-react';
import type { JobApplication } from '@pathforge/shared';
import { useRoadmap } from '../../hooks/useRoadmaps';

interface LinkedRoadmapBlockProps {
  job: JobApplication;
}

export function LinkedRoadmapBlock({ job }: LinkedRoadmapBlockProps) {
  const roadmapId = job.links.roadmapId;
  const { data: roadmap } = useRoadmap(roadmapId);

  if (!roadmapId) return null;

  return (
    <div className="border-t border-slate-200 dark:border-slate-800 pt-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
        Linked roadmap
      </h3>
      <Link
        to={`/roadmaps/${roadmapId}`}
        className="group inline-flex items-center gap-2 w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
      >
        <Compass className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
        <span className="flex-1 text-sm text-slate-900 dark:text-slate-100 truncate">
          {roadmap?.title ?? 'Loading…'}
        </span>
        <ArrowRight className="h-3.5 w-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
      </Link>
    </div>
  );
}
```

- [ ] **Step 4: Wire into the sidebar**

```tsx
import { LinkedRoadmapBlock } from './LinkedRoadmapBlock';

<LinkedRoadmapBlock job={job} />
```

- [ ] **Step 5: Verify build**

Run: `npm -w @pathforge/web run build`. If the current job has no linked roadmap, the block is hidden (you'll wire setting it via `EditJobDialog` in Task 12).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/jobs/LinkedRoadmapBlock.tsx apps/web/src/components/jobs/LinkedRoadmapPicker.tsx apps/web/src/components/jobs/JobDetailSidebar.tsx
git commit -m "feat(web): linked-roadmap sidebar block + typeahead

Sidebar shows the linked roadmap's title with a click-through
arrow when one is set. Adds the LinkedRoadmapPicker primitive
(typeahead over the user's active roadmaps) which the edit
dialog will reuse."
```

---

## Task 11 — `ContactsBlock` + `ContactCard` + `ContactFormDialog`

**Files:**
- Create: `apps/web/src/components/jobs/ContactsBlock.tsx`
- Create: `apps/web/src/components/jobs/ContactCard.tsx`
- Create: `apps/web/src/components/jobs/ContactFormDialog.tsx`
- Modify: `apps/web/src/components/jobs/JobDetailSidebar.tsx`

- [ ] **Step 1: Create `ContactCard.tsx`**

```tsx
// apps/web/src/components/jobs/ContactCard.tsx
import { Pencil, Trash2 } from 'lucide-react';
import type { Contact } from '@pathforge/shared';

interface ContactCardProps {
  contact: Contact;
  onEdit: () => void;
  onDelete: () => void;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p.charAt(0).toUpperCase()).join('');
}

export function ContactCard({ contact, onEdit, onDelete }: ContactCardProps) {
  return (
    <div className="group flex items-center gap-2.5 py-2">
      <div className="h-7 w-7 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center text-[10px] font-semibold">
        {initials(contact.name) || '?'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
          {contact.name}
        </div>
        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
          {[contact.role, contact.email].filter(Boolean).join(' · ') || (
            <span className="italic">no role/email</span>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={onEdit}
        aria-label="Edit contact"
        className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-opacity p-1"
      >
        <Pencil className="h-3 w-3" />
      </button>
      <button
        type="button"
        onClick={onDelete}
        aria-label="Delete contact"
        className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-opacity p-1"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Create `ContactFormDialog.tsx`**

```tsx
// apps/web/src/components/jobs/ContactFormDialog.tsx
import { useEffect, useState } from 'react';
import type { Contact } from '@pathforge/shared';
import {
  useAddContact,
  useUpdateContact,
  useDeleteContact,
} from '../../hooks/useJobs';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Input } from '../ui/input';

interface ContactFormDialogProps {
  jobId: string;
  contact?: Contact;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function ContactFormDialog({
  jobId,
  contact,
  open,
  onOpenChange,
}: ContactFormDialogProps) {
  const add = useAddContact(jobId);
  const update = useUpdateContact(jobId, contact?._id ?? '');
  const del = useDeleteContact(jobId, contact?._id ?? '');

  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    if (open) {
      setName(contact?.name ?? '');
      setRole(contact?.role ?? '');
      setEmail(contact?.email ?? '');
    }
  }, [open, contact]);

  const submit = () => {
    if (!name.trim()) return;
    const body = {
      name: name.trim(),
      role: role.trim() || undefined,
      email: email.trim() || undefined,
    };
    if (contact) {
      update.mutate(body, { onSuccess: () => onOpenChange(false) });
    } else {
      add.mutate(body, { onSuccess: () => onOpenChange(false) });
    }
  };

  const pending = contact ? update.isPending : add.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold tracking-tight">
            {contact ? 'Edit contact' : 'Add contact'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <Field label="Name">
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Maya Rao"
            />
          </Field>
          <Field label="Role" optional>
            <Input
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="e.g. Recruiter, Hiring Manager"
            />
          </Field>
          <Field label="Email" optional>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
            />
          </Field>
        </div>

        <DialogFooter className="mt-4 flex items-center justify-between">
          {contact ? (
            <Button
              variant="ghost"
              onClick={() =>
                del.mutate(undefined, { onSuccess: () => onOpenChange(false) })
              }
              className="text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40"
            >
              Delete
            </Button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={submit}
              disabled={!name.trim() || pending}
              className="bg-brand text-white hover:bg-brand-hover"
            >
              {pending ? 'Saving…' : contact ? 'Save' : 'Add'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  optional,
  children,
}: {
  label: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
        {label}
        {optional && (
          <span className="text-slate-400 dark:text-slate-500 font-normal">
            {' '}
            (optional)
          </span>
        )}
      </label>
      {children}
    </div>
  );
}
```

- [ ] **Step 3: Create `ContactsBlock.tsx`**

```tsx
// apps/web/src/components/jobs/ContactsBlock.tsx
import { useState } from 'react';
import { Plus } from 'lucide-react';
import type { Contact, JobApplication } from '@pathforge/shared';
import { ContactCard } from './ContactCard';
import { ContactFormDialog } from './ContactFormDialog';

interface ContactsBlockProps {
  job: JobApplication;
}

export function ContactsBlock({ job }: ContactsBlockProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Contact | undefined>(undefined);

  const openNew = () => {
    setEditing(undefined);
    setDialogOpen(true);
  };
  const openEdit = (c: Contact) => {
    setEditing(c);
    setDialogOpen(true);
  };

  return (
    <div className="border-t border-slate-200 dark:border-slate-800 pt-4">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Contacts
        </h3>
        <button
          type="button"
          onClick={openNew}
          className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
        >
          <Plus className="h-3 w-3" />
          Add
        </button>
      </div>
      {job.contacts.length === 0 ? (
        <p className="text-xs text-slate-400 dark:text-slate-500 italic">
          No contacts yet
        </p>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {job.contacts.map((c) => (
            <ContactCard
              key={c._id}
              contact={c}
              onEdit={() => openEdit(c)}
              onDelete={() => {
                // Inline delete — no confirm, mirrors the small-action UX
                // for low-blast-radius mutations elsewhere in the sidebar.
                openEdit(c);
              }}
            />
          ))}
        </div>
      )}

      <ContactFormDialog
        jobId={job._id}
        contact={editing}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
}
```

The "delete" icon on a `ContactCard` reopens the edit dialog where the destructive button lives — keeping the destructive action behind a deliberate click, consistent with how roadmaps does delete-confirms.

- [ ] **Step 4: Wire into the sidebar**

```tsx
import { ContactsBlock } from './ContactsBlock';

<ContactsBlock job={job} />
```

- [ ] **Step 5: Verify build + smoke**

Run: `npm -w @pathforge/web run build`. In the dev server, click `Add`, add a contact, see it appear; click the pencil to edit; click `Delete` in the dialog footer to remove.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/jobs/ContactsBlock.tsx apps/web/src/components/jobs/ContactCard.tsx apps/web/src/components/jobs/ContactFormDialog.tsx apps/web/src/components/jobs/JobDetailSidebar.tsx
git commit -m "feat(web): ContactsBlock + ContactFormDialog

Sidebar contacts list with inline add/edit/delete via shared
form dialog. Delete lives inside the edit modal so the
destructive action is one deliberate click away from the row."
```

---

## Task 12 — `JobActions` + `EditJobDialog` + `DeleteJobConfirm`

**Files:**
- Create: `apps/web/src/components/jobs/JobActions.tsx`
- Create: `apps/web/src/components/jobs/EditJobDialog.tsx`
- Create: `apps/web/src/components/jobs/DeleteJobConfirm.tsx`
- Modify: `apps/web/src/components/jobs/JobDetailSidebar.tsx`

- [ ] **Step 1: [Read first] Sibling**

Read `apps/web/src/components/roadmaps/EditRoadmapDialog.tsx` and `apps/web/src/components/roadmaps/DeleteRoadmapConfirm.tsx` for the form-state-from-roadmap pattern (`useEffect` sync on `open` change) and the typed delete-confirm.

- [ ] **Step 2: Create `EditJobDialog.tsx`**

```tsx
// apps/web/src/components/jobs/EditJobDialog.tsx
import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';
import type {
  JobApplication,
  JobApplicationStatus,
  WorkMode,
} from '@pathforge/shared';
import { useUpdateJob } from '../../hooks/useJobs';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Calendar } from '../ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { LinkedRoadmapPicker } from './LinkedRoadmapPicker';

interface EditJobDialogProps {
  job: JobApplication;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const STATUSES: JobApplicationStatus[] = [
  'saved',
  'applied',
  'interviewing',
  'offer',
  'rejected',
  'withdrawn',
];

const STATUS_LABEL: Record<JobApplicationStatus, string> = {
  saved: 'Saved',
  applied: 'Applied',
  interviewing: 'Interviewing',
  offer: 'Offer',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
};

export function EditJobDialog({ job, open, onOpenChange }: EditJobDialogProps) {
  const update = useUpdateJob(job._id);

  const [company, setCompany] = useState(job.company);
  const [role, setRole] = useState(job.role);
  const [status, setStatus] = useState<JobApplicationStatus>(job.status);
  const [appliedAt, setAppliedAt] = useState<Date | undefined>(
    job.appliedAt ? new Date(job.appliedAt) : undefined
  );
  const [appliedAtOpen, setAppliedAtOpen] = useState(false);
  const [jobUrl, setJobUrl] = useState(job.jobUrl ?? '');
  const [resumeUrl, setResumeUrl] = useState(job.resumeUrl ?? '');
  const [workMode, setWorkMode] = useState<WorkMode | ''>(job.workMode ?? '');
  const [location, setLocation] = useState(job.location ?? '');
  const [salaryRange, setSalaryRange] = useState(job.salaryRange ?? '');
  const [offerAmount, setOfferAmount] = useState(job.offerAmount ?? '');
  const [tags, setTags] = useState(job.tags.join(', '));
  const [roadmapId, setRoadmapId] = useState<string | undefined>(
    job.links.roadmapId
  );

  // Reset from prop whenever the dialog opens
  useEffect(() => {
    if (open) {
      setCompany(job.company);
      setRole(job.role);
      setStatus(job.status);
      setAppliedAt(job.appliedAt ? new Date(job.appliedAt) : undefined);
      setJobUrl(job.jobUrl ?? '');
      setResumeUrl(job.resumeUrl ?? '');
      setWorkMode(job.workMode ?? '');
      setLocation(job.location ?? '');
      setSalaryRange(job.salaryRange ?? '');
      setOfferAmount(job.offerAmount ?? '');
      setTags(job.tags.join(', '));
      setRoadmapId(job.links.roadmapId);
    }
  }, [open, job]);

  const submit = () => {
    if (!company.trim() || !role.trim()) return;
    update.mutate(
      {
        company: company.trim(),
        role: role.trim(),
        status,
        appliedAt: appliedAt ?? null,
        jobUrl: jobUrl.trim() || null,
        resumeUrl: resumeUrl.trim() || null,
        workMode: workMode || null,
        location: location.trim() || null,
        salaryRange: salaryRange.trim() || null,
        offerAmount: offerAmount.trim() || null,
        tags: tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        links: { roadmapId: roadmapId ?? null },
      },
      { onSuccess: () => onOpenChange(false) }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold tracking-tight">
            Edit application
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <Field label="Company">
            <Input
              value={company}
              onChange={(e) => setCompany(e.target.value)}
            />
          </Field>
          <Field label="Role">
            <Input value={role} onChange={(e) => setRole(e.target.value)} />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Status">
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as JobApplicationStatus)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Applied on">
              <Popover open={appliedAtOpen} onOpenChange={setAppliedAtOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="w-full inline-flex items-center justify-between px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
                  >
                    {appliedAt ? (
                      format(appliedAt, 'MMM d, yyyy')
                    ) : (
                      <span className="text-slate-400 dark:text-slate-500">
                        Pick a date
                      </span>
                    )}
                    <CalendarIcon className="h-3.5 w-3.5 text-slate-400" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={appliedAt}
                    onSelect={(d) => {
                      setAppliedAt(d);
                      setAppliedAtOpen(false);
                    }}
                    autoFocus
                  />
                  {appliedAt && (
                    <div className="border-t p-2">
                      <button
                        type="button"
                        onClick={() => {
                          setAppliedAt(undefined);
                          setAppliedAtOpen(false);
                        }}
                        className="text-xs text-slate-600 dark:text-slate-400 hover:text-red-600 px-2 py-1"
                      >
                        Clear
                      </button>
                    </div>
                  )}
                </PopoverContent>
              </Popover>
            </Field>
          </div>

          <Field label="Job posting URL" optional>
            <Input
              type="url"
              value={jobUrl}
              onChange={(e) => setJobUrl(e.target.value)}
            />
          </Field>

          <Field label="Resume URL" optional>
            <Input
              type="url"
              value={resumeUrl}
              onChange={(e) => setResumeUrl(e.target.value)}
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Work mode" optional>
              <Select
                value={workMode}
                onValueChange={(v) =>
                  setWorkMode(v === 'none' ? '' : (v as WorkMode))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  <SelectItem value="remote">Remote</SelectItem>
                  <SelectItem value="hybrid">Hybrid</SelectItem>
                  <SelectItem value="onsite">Onsite</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field label="Location" optional>
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Salary range" optional>
              <Input
                value={salaryRange}
                onChange={(e) => setSalaryRange(e.target.value)}
                placeholder="$180k – $220k"
              />
            </Field>
            <Field label="Offer amount" optional>
              <Input
                value={offerAmount}
                onChange={(e) => setOfferAmount(e.target.value)}
                placeholder="$240k base + 25%"
              />
            </Field>
          </div>

          <Field label="Tags" optional hint="Comma-separated.">
            <Input value={tags} onChange={(e) => setTags(e.target.value)} />
          </Field>

          <Field label="Linked roadmap" optional>
            <LinkedRoadmapPicker
              value={roadmapId}
              onChange={(id) => setRoadmapId(id)}
            />
          </Field>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={!company.trim() || !role.trim() || update.isPending}
            className="bg-brand text-white hover:bg-brand-hover"
          >
            {update.isPending ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  optional,
  hint,
  children,
}: {
  label: string;
  optional?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
        {label}
        {optional && (
          <span className="text-slate-400 dark:text-slate-500 font-normal">
            {' '}
            (optional)
          </span>
        )}
        {hint && (
          <span className="text-slate-400 dark:text-slate-500 font-normal">
            {' '}
            — {hint}
          </span>
        )}
      </label>
      {children}
    </div>
  );
}
```

(Notes is intentionally omitted from this dialog — it gets its own edit-in-place panel in Task 13.)

- [ ] **Step 3: Create `DeleteJobConfirm.tsx`**

```tsx
// apps/web/src/components/jobs/DeleteJobConfirm.tsx
import { useNavigate } from 'react-router-dom';
import type { JobApplication } from '@pathforge/shared';
import { useDeleteJob } from '../../hooks/useJobs';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';

interface DeleteJobConfirmProps {
  job: JobApplication;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function DeleteJobConfirm({
  job,
  open,
  onOpenChange,
}: DeleteJobConfirmProps) {
  const navigate = useNavigate();
  const del = useDeleteJob(job._id);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete this application?</DialogTitle>
          <DialogDescription>
            {job.company} · {job.role} will be permanently deleted, along with
            its interview rounds, contacts, and notes. This cannot be undone.
            If you just want it out of the way, archive it instead.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() =>
              del.mutate(undefined, {
                onSuccess: () => {
                  onOpenChange(false);
                  navigate('/jobs');
                },
              })
            }
            disabled={del.isPending}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            {del.isPending ? 'Deleting…' : 'Delete forever'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: Create `JobActions.tsx`**

```tsx
// apps/web/src/components/jobs/JobActions.tsx
import { useState } from 'react';
import { Archive, Pencil, Trash2 } from 'lucide-react';
import type { JobApplication } from '@pathforge/shared';
import { useArchiveJob } from '../../hooks/useJobs';
import { EditJobDialog } from './EditJobDialog';
import { DeleteJobConfirm } from './DeleteJobConfirm';

interface JobActionsProps {
  job: JobApplication;
}

export function JobActions({ job }: JobActionsProps) {
  const archive = useArchiveJob(job._id);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <div className="space-y-1 pt-4 border-t border-slate-200 dark:border-slate-800">
      <button
        type="button"
        onClick={() => setEditOpen(true)}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
      >
        <Pencil className="h-3.5 w-3.5" />
        Edit details
      </button>
      <button
        type="button"
        onClick={() => archive.mutate(!job.archived)}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
      >
        <Archive className="h-3.5 w-3.5" />
        {job.archived ? 'Unarchive' : 'Archive'}
      </button>
      <button
        type="button"
        onClick={() => setDeleteOpen(true)}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40 rounded-md transition-colors"
      >
        <Trash2 className="h-3.5 w-3.5" />
        Delete forever
      </button>

      <EditJobDialog job={job} open={editOpen} onOpenChange={setEditOpen} />
      <DeleteJobConfirm
        job={job}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      />
    </div>
  );
}
```

- [ ] **Step 5: Wire into the sidebar**

```tsx
import { JobActions } from './JobActions';

// at the bottom of <aside>:
<JobActions job={job} />
```

- [ ] **Step 6: Verify build + smoke**

Run: `npm -w @pathforge/web run build`. In the dev server: click `Edit details`, change the company, save → reflected. Click `Archive` → the sidebar's back link flips to `Archive`, and the app disappears from `/jobs` (showing up at `/jobs/archived`). Click `Delete forever` → confirmation → app removed, navigation back to `/jobs`.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/jobs/JobActions.tsx apps/web/src/components/jobs/EditJobDialog.tsx apps/web/src/components/jobs/DeleteJobConfirm.tsx apps/web/src/components/jobs/JobDetailSidebar.tsx
git commit -m "feat(web): JobActions (Edit/Archive/Delete) + EditJobDialog

Edit dialog covers every top-level field except notes (which has
its own edit-in-place panel). Archive is an optimistic toggle.
Delete asks for confirmation and navigates back to the list."
```

---

## Task 13 — `JobNotesPanel` (edit-in-place)

**Files:**
- Create: `apps/web/src/components/jobs/JobNotesPanel.tsx`
- Modify: `apps/web/src/pages/JobDetailPage.tsx`

- [ ] **Step 1: Create `JobNotesPanel.tsx`**

```tsx
// apps/web/src/components/jobs/JobNotesPanel.tsx
import { useEffect, useRef, useState } from 'react';
import { Pencil, StickyNote } from 'lucide-react';
import type { JobApplication } from '@pathforge/shared';
import { useUpdateJob } from '../../hooks/useJobs';
import { Textarea } from '../ui/textarea';

interface JobNotesPanelProps {
  job: JobApplication;
}

export function JobNotesPanel({ job }: JobNotesPanelProps) {
  const update = useUpdateJob(job._id);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(job.notes ?? '');
  const ref = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (editing) {
      // focus + place caret at end
      const ta = ref.current;
      if (ta) {
        ta.focus();
        const len = ta.value.length;
        ta.setSelectionRange(len, len);
      }
    }
  }, [editing]);

  // If the source job changes while we're editing, only update the draft
  // when there's no in-progress edit (avoid clobbering the user's input).
  useEffect(() => {
    if (!editing) setDraft(job.notes ?? '');
  }, [job.notes, editing]);

  const save = () => {
    const next = draft.trim();
    const prev = (job.notes ?? '').trim();
    if (next !== prev) {
      update.mutate({ notes: next || null });
    }
    setEditing(false);
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
          <StickyNote className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
          Application notes
        </h3>
        {!editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
          >
            <Pencil className="h-3 w-3" />
            Edit
          </button>
        )}
      </div>

      {!editing && (
        <>
          {job.notes ? (
            <p className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              {job.notes}
            </p>
          ) : (
            <p
              onClick={() => setEditing(true)}
              className="text-sm text-slate-400 dark:text-slate-500 italic cursor-text"
            >
              Add notes — referral context, comp signals, watchouts…
            </p>
          )}
        </>
      )}

      {editing && (
        <Textarea
          ref={ref}
          rows={6}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setDraft(job.notes ?? '');
              setEditing(false);
            }
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              save();
            }
          }}
          placeholder="Notes — markdown not rendered; line breaks preserved."
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Wire into `JobDetailPage.tsx`**

Replace the "Application notes" placeholder block with:

```tsx
import { JobNotesPanel } from '../components/jobs/JobNotesPanel';

<JobNotesPanel job={data} />
```

- [ ] **Step 3: Verify build + smoke**

Run: `npm -w @pathforge/web run build`. Click the empty-state line or the Edit button — textarea appears, type, blur to save. Cmd/Ctrl-Enter saves and exits.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/jobs/JobNotesPanel.tsx apps/web/src/pages/JobDetailPage.tsx
git commit -m "feat(web): JobNotesPanel edit-in-place

Click the empty placeholder or Edit to start a textarea; blur
saves; Escape cancels; Cmd/Ctrl-Enter saves explicitly. Empty
trimmed value clears notes via PATCH { notes: null }."
```

---

## Task 14 — `RoundsPanel` + `RoundCard` (read-only timeline first)

**Files:**
- Create: `apps/web/src/components/jobs/RoundsPanel.tsx`
- Create: `apps/web/src/components/jobs/RoundCard.tsx`
- Modify: `apps/web/src/pages/JobDetailPage.tsx`

This task renders rounds (collapsed by default, expandable) and an "+ Add round" button. The form dialog comes next (Task 15); the outcome toggle and reorder come in Tasks 16/17.

- [ ] **Step 1: Create `RoundCard.tsx` (read-only render + collapse)**

```tsx
// apps/web/src/components/jobs/RoundCard.tsx
import { useState } from 'react';
import { ChevronDown, ChevronRight, MessageCircleQuestion, NotebookPen, Sparkles } from 'lucide-react';
import type { InterviewRound, RoundOutcome } from '@pathforge/shared';
import { cn } from '../../lib/utils';

interface RoundCardProps {
  index: number;
  round: InterviewRound;
}

const OUTCOME_CLASS: Record<RoundOutcome, string> = {
  pending:
    'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
  passed:
    'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
  failed: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300',
};

function isUpcoming(round: InterviewRound): boolean {
  if (round.outcome !== 'pending') return false;
  if (!round.scheduledAt) return false;
  return new Date(round.scheduledAt).getTime() > Date.now();
}

function outcomeLabel(round: InterviewRound): string {
  if (round.outcome === 'pending' && isUpcoming(round)) return 'Upcoming';
  if (round.outcome === 'pending') return 'Pending';
  return round.outcome === 'passed' ? 'Passed' : 'Failed';
}

export function RoundCard({ index, round }: RoundCardProps) {
  const [expanded, setExpanded] = useState(false);
  const outcome = outcomeLabel(round);
  const outcomeClass =
    round.outcome === 'pending' && isUpcoming(round)
      ? 'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300'
      : OUTCOME_CLASS[round.outcome];

  return (
    <div
      className={cn(
        'border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 transition-colors',
        !expanded && 'hover:bg-slate-50/60 dark:hover:bg-slate-800/40'
      )}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
      >
        <span className="h-6 w-6 rounded-md bg-violet-100 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300 inline-flex items-center justify-center text-[11px] font-bold">
          {index}
        </span>
        <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          {round.name}
        </span>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {round.scheduledAt &&
            `· ${new Date(round.scheduledAt).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
            })}`}
          {round.durationMinutes && ` · ${round.durationMinutes} min`}
          {round.interviewer && ` · ${round.interviewer}`}
        </span>
        <span
          className={cn(
            'ml-auto inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold',
            outcomeClass
          )}
        >
          {outcome}
        </span>
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-dashed border-slate-200 dark:border-slate-800 px-4 py-4 space-y-4">
          <Section icon={NotebookPen} label="Pre-prep">
            {round.prepNotes ? (
              <p className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                {round.prepNotes}
              </p>
            ) : (
              <Empty>What to study, who to research, questions to ask.</Empty>
            )}
          </Section>

          <Section icon={MessageCircleQuestion} label="Questions asked">
            {round.questions.length > 0 ? (
              <ul className="list-disc pl-6 text-sm text-slate-700 dark:text-slate-300 space-y-1.5 marker:text-slate-400">
                {round.questions.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            ) : (
              <Empty>Log questions they asked you, one per line.</Empty>
            )}
          </Section>

          <Section icon={Sparkles} label="Experience / reflection">
            {round.experience ? (
              <p className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                {round.experience}
              </p>
            ) : (
              <Empty>How it went · lessons · follow-ups.</Empty>
            )}
          </Section>
        </div>
      )}
    </div>
  );
}

function Section({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof NotebookPen;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
        <Icon className="h-3 w-3 opacity-70" />
        {label}
      </div>
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm text-slate-400 dark:text-slate-500 italic">
      {children}
    </p>
  );
}
```

- [ ] **Step 2: Create `RoundsPanel.tsx`**

```tsx
// apps/web/src/components/jobs/RoundsPanel.tsx
import { useState } from 'react';
import { Plus } from 'lucide-react';
import type { JobApplication } from '@pathforge/shared';
import { Button } from '../ui/button';
import { RoundCard } from './RoundCard';

interface RoundsPanelProps {
  job: JobApplication;
}

export function RoundsPanel({ job }: RoundsPanelProps) {
  const [addOpen, setAddOpen] = useState(false);
  const total = job.rounds.length;
  const done = job.rounds.filter((r) => r.outcome === 'passed').length;

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Interview rounds
          </h3>
          {total > 0 && (
            <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[11px] font-medium px-2 py-0.5 rounded-full">
              {done} of {total} done
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-slate-700 dark:text-slate-300"
          onClick={() => setAddOpen(true)}
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          Add round
        </Button>
      </div>

      {total === 0 ? (
        <p className="text-sm text-slate-400 dark:text-slate-500 italic">
          No interview rounds yet. Add one when you have a phone screen scheduled.
        </p>
      ) : (
        <div className="space-y-2.5">
          {job.rounds.map((r, idx) => (
            <RoundCard key={r._id} index={idx + 1} round={r} />
          ))}
        </div>
      )}

      {/* RoundFormDialog wiring lands in Task 15; for now this is a stub. */}
      {addOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setAddOpen(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-xl p-6 max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm text-slate-700 dark:text-slate-300">
              Round form dialog lands in Task 15.
            </p>
            <Button className="mt-4" onClick={() => setAddOpen(false)}>
              Close
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Wire into the detail page**

Replace the rounds placeholder block with:

```tsx
import { RoundsPanel } from '../components/jobs/RoundsPanel';

<RoundsPanel job={data} />
```

- [ ] **Step 4: Verify build**

Run: `npm -w @pathforge/web run build`. For a job with rounds (insert one via `curl` against the backend if needed), the timeline renders; click a row to expand its three sections.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/jobs/RoundsPanel.tsx apps/web/src/components/jobs/RoundCard.tsx apps/web/src/pages/JobDetailPage.tsx
git commit -m "feat(web): read-only rounds timeline

RoundsPanel header with done/total badge and Add Round button
(stub). RoundCard renders a collapsed row with index + name +
date + duration + interviewer + outcome chip (Upcoming derived
from scheduledAt > now). Expanding shows the three sub-sections:
Pre-prep, Questions asked, Experience/reflection."
```

---

## Task 15 — `RoundFormDialog` (add / edit a round)

**Files:**
- Create: `apps/web/src/components/jobs/RoundFormDialog.tsx`
- Modify: `apps/web/src/components/jobs/RoundsPanel.tsx`
- Modify: `apps/web/src/components/jobs/RoundCard.tsx`

- [ ] **Step 1: Create `RoundFormDialog.tsx`**

```tsx
// apps/web/src/components/jobs/RoundFormDialog.tsx
import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';
import type { InterviewRound, RoundOutcome } from '@pathforge/shared';
import {
  useAddRound,
  useDeleteRound,
  useUpdateRound,
} from '../../hooks/useJobs';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Calendar } from '../ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';

interface RoundFormDialogProps {
  jobId: string;
  round?: InterviewRound;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const OUTCOMES: RoundOutcome[] = ['pending', 'passed', 'failed'];
const OUTCOME_LABEL: Record<RoundOutcome, string> = {
  pending: 'Pending',
  passed: 'Passed',
  failed: 'Failed',
};

export function RoundFormDialog({
  jobId,
  round,
  open,
  onOpenChange,
}: RoundFormDialogProps) {
  const add = useAddRound(jobId);
  const update = useUpdateRound(jobId, round?._id ?? '');
  const del = useDeleteRound(jobId, round?._id ?? '');

  const [name, setName] = useState('');
  const [scheduledAt, setScheduledAt] = useState<Date | undefined>(undefined);
  const [dateOpen, setDateOpen] = useState(false);
  const [duration, setDuration] = useState('');
  const [interviewer, setInterviewer] = useState('');
  const [outcome, setOutcome] = useState<RoundOutcome>('pending');
  const [questions, setQuestions] = useState('');

  useEffect(() => {
    if (open) {
      setName(round?.name ?? '');
      setScheduledAt(
        round?.scheduledAt ? new Date(round.scheduledAt) : undefined
      );
      setDuration(
        round?.durationMinutes ? String(round.durationMinutes) : ''
      );
      setInterviewer(round?.interviewer ?? '');
      setOutcome(round?.outcome ?? 'pending');
      setQuestions(round?.questions.join('\n') ?? '');
    }
  }, [open, round]);

  const submit = () => {
    if (!name.trim()) return;
    const body = {
      name: name.trim(),
      scheduledAt: scheduledAt ?? null,
      durationMinutes: duration.trim() ? Number(duration) : null,
      interviewer: interviewer.trim() || null,
      outcome,
      questions: questions
        .split('\n')
        .map((q) => q.trim())
        .filter(Boolean),
    } as const;

    if (round) {
      update.mutate(body, { onSuccess: () => onOpenChange(false) });
    } else {
      // For new rounds, null fields shouldn't be sent; convert to undefined.
      const createBody = {
        name: body.name,
        scheduledAt: body.scheduledAt ?? undefined,
        durationMinutes: body.durationMinutes ?? undefined,
        interviewer: body.interviewer ?? undefined,
        outcome: body.outcome,
        questions: body.questions,
      };
      add.mutate(createBody, { onSuccess: () => onOpenChange(false) });
    }
  };

  const pending = round ? update.isPending : add.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold tracking-tight">
            {round ? 'Edit round' : 'Add round'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <Field label="Name">
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Phone Screen, Technical, Onsite"
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Scheduled" optional>
              <Popover open={dateOpen} onOpenChange={setDateOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="w-full inline-flex items-center justify-between px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
                  >
                    {scheduledAt ? (
                      format(scheduledAt, 'MMM d, yyyy')
                    ) : (
                      <span className="text-slate-400 dark:text-slate-500">
                        Pick a date
                      </span>
                    )}
                    <CalendarIcon className="h-3.5 w-3.5 text-slate-400" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={scheduledAt}
                    onSelect={(d) => {
                      setScheduledAt(d);
                      setDateOpen(false);
                    }}
                    autoFocus
                  />
                  {scheduledAt && (
                    <div className="border-t p-2">
                      <button
                        type="button"
                        onClick={() => {
                          setScheduledAt(undefined);
                          setDateOpen(false);
                        }}
                        className="text-xs text-slate-600 dark:text-slate-400 hover:text-red-600 px-2 py-1"
                      >
                        Clear
                      </button>
                    </div>
                  )}
                </PopoverContent>
              </Popover>
            </Field>

            <Field label="Duration (min)" optional>
              <Input
                type="number"
                inputMode="numeric"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="60"
              />
            </Field>
          </div>

          <Field label="Interviewer" optional>
            <Input
              value={interviewer}
              onChange={(e) => setInterviewer(e.target.value)}
              placeholder="e.g. Daniel Kim (Hiring Manager)"
            />
          </Field>

          <Field label="Outcome">
            <Select
              value={outcome}
              onValueChange={(v) => setOutcome(v as RoundOutcome)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OUTCOMES.map((o) => (
                  <SelectItem key={o} value={o}>
                    {OUTCOME_LABEL[o]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field
            label="Questions asked"
            optional
            hint="One question per line."
          >
            <Textarea
              rows={5}
              value={questions}
              onChange={(e) => setQuestions(e.target.value)}
              placeholder="Design a presence system…\nDebug a memory leak…"
            />
          </Field>
        </div>

        <DialogFooter className="mt-4 flex items-center justify-between">
          {round ? (
            <Button
              variant="ghost"
              onClick={() =>
                del.mutate(undefined, { onSuccess: () => onOpenChange(false) })
              }
              className="text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40"
            >
              Delete round
            </Button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={submit}
              disabled={!name.trim() || pending}
              className="bg-brand text-white hover:bg-brand-hover"
            >
              {pending ? 'Saving…' : round ? 'Save' : 'Add round'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  optional,
  hint,
  children,
}: {
  label: string;
  optional?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
        {label}
        {optional && (
          <span className="text-slate-400 dark:text-slate-500 font-normal">
            {' '}
            (optional)
          </span>
        )}
        {hint && (
          <span className="text-slate-400 dark:text-slate-500 font-normal">
            {' '}
            — {hint}
          </span>
        )}
      </label>
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Wire `RoundsPanel` to use the real dialog**

In `RoundsPanel.tsx`, replace the stub-modal section with:

```tsx
import { RoundFormDialog } from './RoundFormDialog';

// remove the stub overlay; instead:
<RoundFormDialog jobId={job._id} open={addOpen} onOpenChange={setAddOpen} />
```

- [ ] **Step 3: Wire edit-round from `RoundCard`**

In `RoundCard.tsx`, add an "Edit" button that opens the form pre-filled. Add it next to the chevron, visible on hover. The card now needs the `jobId`:

```tsx
// signature update
interface RoundCardProps {
  jobId: string;
  index: number;
  round: InterviewRound;
}

// inside the card, before the chevron:
const [editOpen, setEditOpen] = useState(false);

<span
  role="button"
  tabIndex={0}
  aria-label="Edit round"
  onClick={(e) => {
    e.stopPropagation();
    setEditOpen(true);
  }}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      setEditOpen(true);
    }
  }}
  className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-300 transition-opacity"
>
  <Pencil className="h-3.5 w-3.5" />
</span>

// at the bottom of the card:
<RoundFormDialog
  jobId={jobId}
  round={round}
  open={editOpen}
  onOpenChange={setEditOpen}
/>
```

Update the outer wrapper className to include `group` so the `group-hover` class works. Add `Pencil` to the imports and pass `jobId` through from `RoundsPanel`:

```tsx
// In RoundsPanel.tsx:
<RoundCard key={r._id} jobId={job._id} index={idx + 1} round={r} />
```

- [ ] **Step 4: Verify build + smoke**

Run: `npm -w @pathforge/web run build`. Add a round; edit it; delete it from the edit dialog footer.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/jobs/RoundFormDialog.tsx apps/web/src/components/jobs/RoundsPanel.tsx apps/web/src/components/jobs/RoundCard.tsx
git commit -m "feat(web): RoundFormDialog add/edit/delete

Name + scheduled date + duration + interviewer + outcome +
questions (one per line). Reused for add (POST) and edit (PATCH);
the dialog footer holds the destructive delete action when
editing an existing round."
```

---

## Task 16 — Outcome chip toggle + per-round prep/experience edit-in-place

**Files:**
- Modify: `apps/web/src/components/jobs/RoundCard.tsx`

This task makes the outcome chip clickable for a quick cycle through `pending → passed → failed → pending`, and turns the prep-notes and experience sections into edit-in-place fields (mirroring the application-notes panel).

- [ ] **Step 1: Update `RoundCard.tsx`**

Add these imports and helpers at the top:

```tsx
import { useEffect, useRef, useState } from 'react';
import { useUpdateRound } from '../../hooks/useJobs';
import { Textarea } from '../ui/textarea';

const OUTCOME_ORDER: RoundOutcome[] = ['pending', 'passed', 'failed'];
function nextOutcome(o: RoundOutcome): RoundOutcome {
  const i = OUTCOME_ORDER.indexOf(o);
  return OUTCOME_ORDER[(i + 1) % OUTCOME_ORDER.length];
}
```

Wire the mutation inside the component:

```tsx
const update = useUpdateRound(jobId, round._id);

// Replace the outcome span with a clickable button:
<button
  type="button"
  onClick={(e) => {
    e.stopPropagation();
    update.mutate({ outcome: nextOutcome(round.outcome) });
  }}
  aria-label={`Outcome ${outcome}; click to cycle`}
  className={cn(
    'ml-auto inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold hover:opacity-90 transition-opacity',
    outcomeClass
  )}
>
  {outcome}
</button>
```

Convert the `prepNotes` and `experience` sections into edit-in-place blocks. Replace the existing `<Section>` calls for those two with `<EditableTextSection>`:

```tsx
function EditableTextSection({
  jobId,
  roundId,
  field,
  initial,
  label,
  placeholder,
  icon: Icon,
}: {
  jobId: string;
  roundId: string;
  field: 'prepNotes' | 'experience';
  initial: string | undefined;
  label: string;
  placeholder: string;
  icon: typeof NotebookPen;
}) {
  const update = useUpdateRound(jobId, roundId);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initial ?? '');
  const ref = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (editing && ref.current) {
      ref.current.focus();
      const len = ref.current.value.length;
      ref.current.setSelectionRange(len, len);
    }
  }, [editing]);

  useEffect(() => {
    if (!editing) setDraft(initial ?? '');
  }, [initial, editing]);

  const save = () => {
    const next = draft.trim();
    if (next !== (initial ?? '').trim()) {
      update.mutate({ [field]: next || null } as never);
    }
    setEditing(false);
  };

  return (
    <div>
      <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
        <Icon className="h-3 w-3 opacity-70" />
        {label}
      </div>
      {!editing && initial && (
        <p
          onClick={() => setEditing(true)}
          className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300 leading-relaxed cursor-text"
        >
          {initial}
        </p>
      )}
      {!editing && !initial && (
        <p
          onClick={() => setEditing(true)}
          className="text-sm text-slate-400 dark:text-slate-500 italic cursor-text"
        >
          {placeholder}
        </p>
      )}
      {editing && (
        <Textarea
          ref={ref}
          rows={4}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setDraft(initial ?? '');
              setEditing(false);
            }
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              save();
            }
          }}
          placeholder={placeholder}
        />
      )}
    </div>
  );
}

// Then in the expanded body, replace:
<Section icon={NotebookPen} label="Pre-prep">…</Section>
<Section icon={Sparkles} label="Experience / reflection">…</Section>

// with:
<EditableTextSection
  jobId={jobId}
  roundId={round._id}
  field="prepNotes"
  initial={round.prepNotes}
  label="Pre-prep"
  placeholder="What to study, who to research, questions to ask."
  icon={NotebookPen}
/>
<EditableTextSection
  jobId={jobId}
  roundId={round._id}
  field="experience"
  initial={round.experience}
  label="Experience / reflection"
  placeholder="How it went · lessons · follow-ups."
  icon={Sparkles}
/>
```

(`Section` is still used by the "Questions asked" block — keep it.)

The Questions asked list stays read-only here; it's edited via the `RoundFormDialog` (Task 15). That's a deliberate split: prep/experience are paragraphs that benefit from edit-in-place; questions are a list that benefits from a dedicated form view.

- [ ] **Step 2: Verify build + smoke**

Run: `npm -w @pathforge/web run build`. Click an outcome chip to cycle it (uses the optimistic update wired in `useUpdateRound`). Click the prep paragraph to edit in place; type, blur to save.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/jobs/RoundCard.tsx
git commit -m "feat(web): round outcome cycle + prep/experience edit-in-place

Clicking the outcome chip cycles pending → passed → failed → ...
via the existing useUpdateRound optimistic path. Prep notes and
experience paragraphs become editable textareas on click; blur
or Cmd-Enter saves. Questions stay edited via the form dialog."
```

---

## Task 17 — Round drag-and-drop reorder

**Files:**
- Modify: `apps/web/src/components/jobs/RoundsPanel.tsx`
- Modify: `apps/web/src/components/jobs/RoundCard.tsx`

- [ ] **Step 1: [Read first] Sibling drag-drop**

Read `apps/web/src/components/roadmaps/MilestoneList.tsx` for the exact dnd-kit shape (`DndContext`, `SortableContext`, `useSensors`, `arrayMove`, `verticalListSortingStrategy`). Read `apps/web/src/components/roadmaps/StepRow.tsx` for the `useSortable` per-item hook + drag handle pattern.

- [ ] **Step 2: Wrap `RoundsPanel` rendering in dnd context**

```tsx
// apps/web/src/components/jobs/RoundsPanel.tsx
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useReorderRounds } from '../../hooks/useJobs';

// inside the component, replace the simple .map() with:
const reorder = useReorderRounds(job._id);

const sensors = useSensors(
  useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  useSensor(KeyboardSensor, {
    coordinateGetter: sortableKeyboardCoordinates,
  })
);

const handleDragEnd = (e: DragEndEvent) => {
  const { active, over } = e;
  if (!over || active.id === over.id) return;
  const ids = job.rounds.map((r) => r._id);
  const oldIndex = ids.indexOf(String(active.id));
  const newIndex = ids.indexOf(String(over.id));
  if (oldIndex < 0 || newIndex < 0) return;
  const next = arrayMove(ids, oldIndex, newIndex);
  reorder.mutate(next);
};

// And the list block:
<DndContext
  sensors={sensors}
  collisionDetection={closestCenter}
  onDragEnd={handleDragEnd}
>
  <SortableContext
    items={job.rounds.map((r) => r._id)}
    strategy={verticalListSortingStrategy}
  >
    <div className="space-y-2.5">
      {job.rounds.map((r, idx) => (
        <RoundCard key={r._id} jobId={job._id} index={idx + 1} round={r} />
      ))}
    </div>
  </SortableContext>
</DndContext>
```

- [ ] **Step 3: Update `RoundCard` to be sortable + add a drag handle**

In `RoundCard.tsx`:

```tsx
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';

// inside component:
const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
  useSortable({ id: round._id });

const style = {
  transform: CSS.Transform.toString(transform),
  transition,
};

// Apply to outer div, add group class:
<div
  ref={setNodeRef}
  style={style}
  className={cn(
    'group border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 transition-colors',
    !expanded && 'hover:bg-slate-50/60 dark:hover:bg-slate-800/40',
    isDragging && 'shadow-md ring-1 ring-slate-300 dark:ring-slate-700 z-10'
  )}
>

// Inside the header button, add a drag handle as the first child:
<span
  {...attributes}
  {...listeners}
  role="button"
  tabIndex={0}
  aria-label="Drag round"
  onClick={(e) => e.stopPropagation()}
  className="text-slate-300 dark:text-slate-600 hover:text-slate-500 dark:hover:text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
>
  <GripVertical className="h-3.5 w-3.5" />
</span>
```

- [ ] **Step 4: Verify build + smoke**

Run: `npm -w @pathforge/web run build`. On the detail page with 2+ rounds, hover a row to see the grip handle; drag to reorder. The optimistic update should give immediate visual feedback; the network call persists order.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/jobs/RoundsPanel.tsx apps/web/src/components/jobs/RoundCard.tsx
git commit -m "feat(web): round drag-and-drop reorder

@dnd-kit/sortable wraps RoundsPanel. Each RoundCard exposes a
grip handle on hover; dragging reorders in place and calls
useReorderRounds, which optimistically updates the detail cache
and rolls back on error."
```

---

## Task 18 — `/jobs/archived` polish + archived UX

**Files:**
- Modify: `apps/web/src/pages/JobsListPage.tsx`
- Modify: `apps/web/src/components/jobs/JobsToolbar.tsx`

The route exists already; this task ensures the archived view is coherent (no "+ New" button, status pills hidden, empty-state copy correct) and that the toolbar shape is right.

- [ ] **Step 1: Already-implemented behaviour to verify**

Going by Task 3, the toolbar hides status pills when `archived === true`. The header hides the "+ New application" button when `archived === true`. The empty state shows the archived copy. Confirm all three by visiting `/jobs/archived` in the dev server.

- [ ] **Step 2: Add a small clarity tweak — show counts on the archived toggle**

In `JobsToolbar.tsx`, when archived is `false`, the active toggle pill should show the count of active applications inline, and vice versa. This makes the segmented control more informative without adding new chrome.

Pass two new optional props:

```tsx
interface JobsToolbarProps {
  // …existing
  activeCount?: number;
  archivedCount?: number;
}
```

In the two `<Link>` elements, append the count:

```tsx
<Link to="/jobs" ...>
  Active
  {activeCount !== undefined && (
    <span className="ml-1.5 text-xs text-slate-400 dark:text-slate-500">
      {activeCount}
    </span>
  )}
</Link>
<Link to="/jobs/archived" ...>
  Archive
  {archivedCount !== undefined && (
    <span className="ml-1.5 text-xs text-slate-400 dark:text-slate-500">
      {archivedCount}
    </span>
  )}
</Link>
```

- [ ] **Step 3: Wire the counts in `JobsListPage`**

To populate both counts, fetch the inverse list lazily:

```tsx
// In JobsListPage, near the top:
const { data: counterpart } = useJobs({ archived: !archived });

// Pass to the toolbar:
<JobsToolbar
  archived={archived}
  query={query}
  onQueryChange={setQuery}
  statusFilter={statusFilter}
  onStatusFilterChange={setStatusFilter}
  counts={counts}
  activeCount={archived ? counterpart?.length : data?.length}
  archivedCount={archived ? data?.length : counterpart?.length}
/>
```

TanStack Query will dedupe; this is a small extra fetch, fine at personal scale.

- [ ] **Step 4: Verify build + smoke**

Run: `npm -w @pathforge/web run build`. Toggle between Active and Archive views; both pills show counts.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/jobs/JobsToolbar.tsx apps/web/src/pages/JobsListPage.tsx
git commit -m "feat(web): show counts on Active/Archive toggle

Small counter next to each pill so the user can see how many
apps live on each side without flipping tabs. Driven by an
inverse useJobs query on each list page render — TanStack Query
dedupes, so cost is one extra fetch per page load."
```

---

## Acceptance Checklist

After Task 18 commits, the frontend half of the feature is done. Verify:

- [ ] `npm -w @pathforge/web run build` is clean.
- [ ] `git log --oneline` shows ~18 task commits with descriptive messages.
- [ ] Manual end-to-end smoke (against a running `docker compose up`):
  - [ ] `/jobs` shows the list page with status filter pills and search.
  - [ ] Empty state and no-results state render correctly.
  - [ ] "+ New application" creates an app and navigates to its detail.
  - [ ] Detail page shows sidebar (status, quick facts, tags, contacts, actions) and main content (notes + rounds).
  - [ ] Status picker, tag add/remove, contact add/edit/delete, edit-job dialog, archive/unarchive, delete confirmation all work.
  - [ ] Notes edit-in-place saves on blur and on Cmd-Enter.
  - [ ] Rounds: add via dialog; expand to see prep/questions/experience; edit prep & experience in place; click outcome chip to cycle; drag handle reorders.
  - [ ] `/jobs/archived` renders archived apps with the right copy and no "+ New" button.
  - [ ] Linked roadmap badge in the sidebar navigates to the roadmap.

## What's Next

After this plan merges:

- **Resources feature** (third deferred PROJECT.md item) — links library that can reference roadmaps or applications.
- **Sort toggle on the list page** — spec calls for a secondary `appliedAt desc` sort alongside the default `updatedAt desc`. Tiny addition: a "Sort by recent / Sort by applied date" toggle in `JobsToolbar`, with a `sortKey` state in `JobsListPage` driving the filtered `useMemo`. Deferred from this plan to keep Task 3 focused; default sort is already correct.
- Optional follow-ups raised during the backend phase, all `fix-later`:
  - Lift `ReorderRequestSchema` shared between roadmaps and jobs.
  - Decide whether to dedupe Mongoose vs handler defaults on POST endpoints.

The frontend `useJobs` hooks are designed so a future "all apps linked to roadmap X" page just needs a new `useJobsByRoadmap(roadmapId)` query — the index in the backend already supports it.
