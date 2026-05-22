# Dashboard Widgets — Design

*2026-05-22*

## Purpose

Replace the near-empty dashboard with three feature-specific widgets: a hero Journal "Today" card and two secondary widgets for Roadmaps and Jobs. Each widget shows glanceable state from its feature and exposes a single "+ New …" entry shortcut alongside an "Open →" link. The result is a landing pad that tells the demoer "here's where you are today" and lets them dive in with one click.

## Goals

- One look at the dashboard answers: did I journal today? what's the most-current roadmap doing? what's my most pressing job application?
- "Open X →" link on every widget makes each feature one click away.
- "+ New" inline action on each widget gives a single-tap entry point for the most common create-flow.
- Empty states tell the user what the feature does and prompt them to start.
- No new API endpoints; everything reuses existing TanStack Query caches.
- The Journal tutorial's `data-tour="journal-today-card"` anchor keeps working on the new larger hero card.

## Non-Goals

- A drag-and-drop, configurable widget grid.
- New API endpoints or schema changes.
- Inline create-flow modals on the dashboard (the "+ New" action routes to the feature's list page, which has the canonical create UI).
- Per-user widget preferences (which widgets show, in what order).
- A "recent activity" timeline aggregating events across all three features.
- Mood charts or analytics — the heatmap is just the existing per-day color, not a new visualization.

## Architecture

```
                Dashboard (apps/web/src/pages/Dashboard.tsx)
                            │
              ┌─────────────┼──────────────────┐
              ▼             ▼                  ▼
        Welcome heading  Hero card        Secondary 2-col grid
                         │                ┌──────┴───────┐
                         │                ▼              ▼
                JournalTodayCard   RoadmapsWidget   JobsWidget
                (existing,            (new)            (new)
                 enlarged)               │                │
                         │                │                │
                  useJournalDay     useRoadmaps      useJobs
                  useJournalMonth   ({active})       ({active})
                                    useRoadmaps
                                    ({archived})
```

All data lives in already-cached TanStack queries. The dashboard mount warms them; subsequent navigations to `/journal`, `/roadmaps`, `/jobs` reuse the cache.

## Load-Bearing Rules Respected

- **Shared schema keystone preserved.** No schema changes; widgets consume the existing `Roadmap`, `JobApplication`, `JournalDay` types from `@pathforge/shared`.
- **`userId` multi-tenant boundary preserved.** No new queries; existing hooks already filter by the session user.
- **Auth shape unchanged.** Dashboard remains under `<RequireAuth>` via the existing `Protected` wrapper in `App.tsx`.
- **TanStack Query cache keys unchanged.** Dashboard widgets reuse `['roadmaps', ...]`, `['jobs', ...]`, `['journal', 'day', ...]`, `['journal', 'month', ...]`. Mutations from inside the features automatically refresh the dashboard via cache invalidation.
- **Tour markers preserved.** `data-tour="journal-today-card"` is added to all three render branches of the new hero card, matching the existing convention (one marker per render branch so the callout anchors regardless of which state shows).

## Hero — JournalTodayCard (Modified)

Grows from a small prompt-or-summary card into the page hero with mood, summary, tags, and a 14-day mini heatmap.

### Three render branches

All three are wrapped in:
```tsx
<div data-tour="journal-today-card" className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-6">
```

**Loading** — single skeleton bar (unchanged from today).

**Empty** — `useJournalDay(today)` returns null:
```
┌─ Today's journal · Fri, May 22 ─────────────────────────────┐
│  How are you feeling today?                                 │
│  [ 😢  😟  😐  🙂  😄 ]   ← clicking saves mood-only + nav  │
│                                                             │
│  Last 14 days  ▣ ▣ ░ ▤ ▥ ▢ ▣ ▣ ▣ ▥ ▢ ▣ ▥ ○                  │
│                                                             │
│                                          Open Journal →    │
└─────────────────────────────────────────────────────────────┘
```

**Filled** — `useJournalDay(today)` returns the day:
```
┌─ Today's journal · Fri, May 22 ─────────────────────────────┐
│                                                       ┌─┐  │
│  Pushed the tour fix.                                 │🙂│  │
│                                                       └─┘  │
│  [focused] [grateful]                                       │
│                                                             │
│  Last 14 days  ▣ ▣ ░ ▤ ▥ ▢ ▣ ▣ ▣ ▥ ▢ ▣ ▥ ◾  ← today        │
│                                                             │
│  + Add an event                          Open Journal →    │
└─────────────────────────────────────────────────────────────┘
```

### Heatmap

A 14-cell strip showing the last 14 days, today on the right. Reads from `useJournalMonth(monthOf(today))` (and a second `useJournalMonth(monthOf(previousMonth))` only when the 14-day window crosses a month boundary). Each cell:

- Day with an entry: colored by `mood.scale` using the existing 5-stop `SCALE_BG` palette extracted from `JournalMonthGrid.tsx`.
- Day without an entry: `bg-slate-50 dark:bg-slate-900`.
- Today cell: `ring-2 ring-slate-900 dark:ring-slate-100` overlay.

To avoid duplicating the palette, the constant moves out of `JournalMonthGrid.tsx` into a new shared module `apps/web/src/lib/moodColors.ts` and both consumers import it.

### Inline action — `+ Add an event`

Only shown on the filled state. Renders as a small text link in the card footer. Clicking navigates to `/journal?date=<today>` — the user lands on the day editor where the "+ add event" button is already a click away. We do NOT scroll/focus the events section; the dashboard hands off cleanly.

### Empty-state mood buttons

Same five emoji buttons as today's implementation, with the same behavior: click saves a mood-only day (`{ mood: { scale: i + 1, tags: [] } }`) and navigates to `/journal?date=<today>`.

## RoadmapsWidget (New)

File: `apps/web/src/components/dashboard/RoadmapsWidget.tsx`.

### Data

```ts
const { data: active = [] } = useRoadmaps({ archived: false });
const { data: archived = [] } = useRoadmaps({ archived: true });
```

### Render

If `active.length > 0`:
- **Highlight pick:** the active roadmap with the most-recent `updatedAt`.
- **Progress bar:** thin (`h-1.5`) bar showing `completedSteps / totalSteps` across all milestones of the highlight. `completedSteps = sum of milestone.steps.filter(s => s.completed).length`. Bar uses `bg-sky-500` to match the Roadmaps icon color.
- **Caption:** `"X of Y steps"`.
- **Counts line:** `"{active.length} active · {archived.length} archived"`.

If `active.length === 0` and `archived.length === 0`:
- Empty-state copy: "Break a goal into milestones with steps."

If `active.length === 0` but `archived.length > 0`:
- Same empty-state copy (the tagline applies regardless). No archive callout — we don't want the empty active state to feel cluttered.

### Footer

```
+ New                                     Open Roadmaps →
```

Both routes go to `/roadmaps`. The `+ New` link doesn't open a modal here — the user lands on the list page and uses its existing "+ New" affordance.

## JobsWidget (New)

File: `apps/web/src/components/dashboard/JobsWidget.tsx`.

### Data

```ts
const { data: active = [] } = useJobs({ archived: false });
```

Only active jobs — the dashboard widget is about pending action, not history.

### Highlight pick

Priority order:
1. First `status === 'offer'` (sorted by `updatedAt desc` within ties).
2. First `status === 'interviewing'`.
3. First `status === 'applied'` (most recent).
4. First any-status (most recent overall).

Renders `<company> · <role>` on one line and a status caption on the next:

| Status | Caption |
|---|---|
| `offer` | "Offer · awaiting decision" |
| `interviewing` | "Interviewing" |
| `applied` | "Applied" |
| `saved` | "Saved" |
| `rejected` | "Rejected" |
| `withdrawn` | "Withdrawn" |

(No relative-time computation in v1 — just the status label.)

### Status counts row

Counts of `active` jobs grouped by status. Only render pills for statuses with `count ≥ 1`. Pill order: `saved · applied · interviewing · offer · rejected · withdrawn`. Each pill: `"{Label} {count}"`.

### Empty state

If `active.length === 0`:
- "Track applications, rounds, and outcomes."

### Footer

```
+ New                                          Open Jobs →
```

Both routes go to `/jobs`.

## Dashboard.tsx (Modified)

```tsx
import { useMe } from '@/hooks/useAuth';
import { JournalTodayCard } from '@/components/journal/JournalTodayCard';
import { RoadmapsWidget } from '@/components/dashboard/RoadmapsWidget';
import { JobsWidget } from '@/components/dashboard/JobsWidget';

export default function Dashboard() {
  const { data: me } = useMe();
  return (
    <main className="container py-10 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Welcome, {me?.name}.</h1>
        <p className="text-muted-foreground mt-2">
          Today's pulse, plus your roadmaps and applications a click away.
        </p>
      </div>

      <JournalTodayCard />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <RoadmapsWidget />
        <JobsWidget />
      </div>
    </main>
  );
}
```

## Shared Color Module

New file: `apps/web/src/lib/moodColors.ts`.

```ts
export const MOOD_SCALE_BG: Record<number, string> = {
  1: 'bg-red-300 dark:bg-red-900 text-red-900 dark:text-red-100',
  2: 'bg-orange-300 dark:bg-orange-900 text-orange-900 dark:text-orange-100',
  3: 'bg-slate-300 dark:bg-slate-700 text-slate-800 dark:text-slate-200',
  4: 'bg-emerald-300 dark:bg-emerald-900 text-emerald-900 dark:text-emerald-100',
  5: 'bg-sky-300 dark:bg-sky-900 text-sky-900 dark:text-sky-100',
};
```

`JournalMonthGrid.tsx` switches from its inline `SCALE_BG` constant to importing from `moodColors.ts`. `JournalTodayCard.tsx` imports the same.

## Error Handling

- Each widget owns its loading and error states.
- On `useRoadmaps` / `useJobs` / `useJournalDay` error, the widget renders a quiet "Couldn't load" line with the `Open X →` link still active (so the user can still navigate in to debug).
- The hero card's empty-state mood buttons stay disabled during the save mutation (existing behavior).

## Testing

No automated frontend tests (matches project posture). Manual smoke through `docker compose up`:

1. Log in as Pathfinder Demo → dashboard renders three elements: welcome heading, hero Today card, two-column secondary grid.
2. Hero card: 🙂 mood (32px), summary "Pushed the tour fix.", chips `focused, grateful`, 14-day heatmap painted with seeded mood colors and today's cell ringed.
3. RoadmapsWidget: highlight "Land a senior backend role" with a progress bar (~64% if the demo seed is unchanged), "2 active · 1 archived" counts. `+ New` and `Open Roadmaps →` both go to `/roadmaps`.
4. JobsWidget: highlight "Anthropic · Backend Engineer · Offer · awaiting decision", status pills "Saved 1 · Applied 1 · Interviewing 1 · Offer 1 · Rejected 1". `+ New` and `Open Jobs →` both go to `/jobs`.
5. Log in as Ada (no seed): hero card shows "How are you feeling today?" + emoji buttons. RoadmapsWidget shows "Break a goal into milestones with steps." JobsWidget shows "Track applications, rounds, and outcomes." Both secondary widgets show `+ New` links.
6. Click an emoji on the empty hero card → day is saved, route changes to `/journal?date=<today>`, dashboard's cache invalidates (visible if you navigate back).
7. The Journal tutorial's step 1 callout (target `[data-tour="journal-today-card"]`) anchors to the new hero card on `/`.

## Open Questions

None.
