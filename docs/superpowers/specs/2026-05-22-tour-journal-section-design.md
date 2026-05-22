# Tour Journal Section — Design

*2026-05-22*

## Purpose

Add a third tutorial — Journal — to the tutorial library that landed in `feat/tour-library`. The Journal feature shipped without any in-tour walkthrough; demo users currently have to discover the daily-pulse card, calendar heatmap, mood picker, events, and references on their own. This branch teaches them in five short steps along the daily-use path.

## Goals

- Library menu shows **three** cards (Roadmaps · Journal · Jobs) in that order — Journal placed between Roadmaps and Jobs to match the navbar's `Roadmaps · Journal · Jobs` ordering, not appended at the end.
- A new `'Journal'` value on `TourStepGroup` carries 5 steps wired into the existing `TOUR_STEPS` array.
- Each step has a `data-tour` target so `TourCallout` anchors near the right UI element across the daily flow (dashboard card → nav → mood picker → events → references).
- Step 2 ("Open your journal") uses the existing CTA + `nextOnPath` mechanism to auto-complete when the user navigates to `/journal`.
- No backend changes; no provider/callout changes.

## Non-Goals

- Editing or restructuring existing Roadmaps / Jobs tour steps.
- Generalizing the tour to non-demo users.
- Adding micro-interactions (animations, confetti, etc.) when a section completes.
- Teaching auxiliary journal features (link editor, summary, page navigation buttons). The five chosen steps are the daily-use spine; everything else is discoverable.

## Architecture

```
                 TourPanel auto-opens
                          │
                          ▼
              ┌────────────────────────┐
              │ Pathfinder tutorials   │
              │                        │
              │ [🗺️ Roadmaps · 5 steps]│
              │ [📓 Journal · 5 steps] │  ← new
              │ [💼 Jobs · 4 steps]    │
              └────────────────────────┘
                          │ click Journal
                          ▼
              ┌────────────────────────┐
              │ ← All tutorials        │
              │ Journal · 0 / 5        │
              │ ○ Today at a glance    │  target: journal-today-card
              │ ○ Open your journal    │  target: nav-journal, CTA → /journal
              │ ○ Set the mood         │  target: mood-picker
              │ ○ Capture an event     │  target: add-event
              │ ○ Link the day to a goal│ target: add-reference
              └────────────────────────┘
```

`TourProvider`, `TourCallout`, and the existing tour-library structure are group-agnostic — the only changes are the new step definitions, the new `SECTION_META` entry, and the `data-tour` markers on the journal UI.

## Load-Bearing Rules Respected

- **No new collections, no schema changes.** Tour content is pure frontend data.
- **Demo-user scope preserved** (`isDemoUser` gate in TourPanel + TourCallout already enforces this).
- **`data-tour` attribute precedent** — the existing markers (`nav-roadmaps`, `roadmap-card`, etc.) define the convention; the five new ones follow the same kebab-case `data-tour="<purpose>"` pattern.
- **Section-scoped auto-advance** (the change from the previous branch) means a `nextOnPath: '/journal'` only fires when the active section is Journal — no cross-section bleed.

## Data Model

### Step content — `apps/web/src/components/tour/tourSteps.ts`

`TourStepGroup` widens:

```ts
export type TourStepGroup = 'Roadmaps' | 'Jobs' | 'Journal';
```

Five new entries appended to `TOUR_STEPS` after the existing Roadmaps + Jobs sets:

```ts
{
  id: 'journal-today-card',
  group: 'Journal',
  title: 'Today at a glance',
  body: 'The dashboard card prompts you when there\'s no entry, or shows mood + summary once you\'ve written today\'s.',
  target: '[data-tour="journal-today-card"]',
},
{
  id: 'journal-open',
  group: 'Journal',
  title: 'Open your journal',
  body: 'The full calendar lives at /journal — mood heatmap on the left, day editor on the right.',
  cta: { label: 'Open Journal', to: '/journal' },
  target: '[data-tour="nav-journal"]',
  nextOnPath: '/journal',
},
{
  id: 'journal-day-mood',
  group: 'Journal',
  title: 'Set the mood',
  body: 'Pick a 1–5 emoji and optional tags (focused, grateful, tired…).',
  target: '[data-tour="mood-picker"]',
},
{
  id: 'journal-add-event',
  group: 'Journal',
  title: 'Capture an important event',
  body: 'Star the ones that mattered. The optional time field timestamps the moment.',
  target: '[data-tour="add-event"]',
},
{
  id: 'journal-add-reference',
  group: 'Journal',
  title: 'Link the day to a goal',
  body: 'Attach a reference to a roadmap, milestone, or job. Stays scoped to your own docs.',
  target: '[data-tour="add-reference"]',
},
```

### `data-tour` markers added (5 total)

| File | Element | New attribute |
|---|---|---|
| `apps/web/src/components/Navbar.tsx` | `<Link to="/journal">` | `data-tour="nav-journal"` |
| `apps/web/src/components/journal/JournalTodayCard.tsx` | outer card `<div>` (both empty-state and filled-state branches) | `data-tour="journal-today-card"` |
| `apps/web/src/components/journal/MoodPicker.tsx` | outer `<div className="space-y-4">` | `data-tour="mood-picker"` |
| `apps/web/src/components/journal/EventList.tsx` | the `+ add event` `<button>` | `data-tour="add-event"` |
| `apps/web/src/components/journal/ReferencesPicker.tsx` | the `+ add reference` `<button>` | `data-tour="add-reference"` |

For `JournalTodayCard`, both render branches (empty prompt and filled state) get the attribute so the callout anchors regardless of which state today's entry is in.

## Library Card Metadata

`apps/web/src/components/tour/TourPanel.tsx`:

- Add `BookOpen` to the lucide-react import.
- Extend `SECTION_META`:

  ```ts
  Journal: {
    icon: BookOpen,
    iconWrapper: 'bg-violet-500/15 text-violet-600 dark:bg-violet-400/15 dark:text-violet-300',
    tagline: 'Daily entries: mood, events, references.',
  },
  ```

- Update `SECTION_ORDER`:

  ```ts
  const SECTION_ORDER: TourStepGroup[] = ['Roadmaps', 'Journal', 'Jobs'];
  ```

Color choice: violet stands cleanly apart from sky (Roadmaps) and emerald (Jobs). Three distinct hues, no collisions with the rest of the app palette.

## Error Handling

Nothing new. The existing TourCallout already handles "target selector matches no DOM element" by setting `visible = false` until the element appears (with a retry after 80ms for animated mounts). The journal targets exist on the appropriate routes:

- `journal-today-card` — visible on `/` (dashboard)
- `nav-journal` — visible on every protected route via the Navbar
- `mood-picker`, `add-event`, `add-reference` — visible on `/journal` once a day is selected (i.e., always, since `JournalPage` defaults to today)

If a user manually completes step 2 from a route where the journal page isn't open (e.g., from `/roadmaps`), step 3's callout won't appear until they navigate to `/journal`. That's acceptable — the step still renders in the panel's step list with its text and the user can advance manually.

## Testing

No automated frontend tests (matches project posture). Manual smoke through `docker compose up`:

1. Log in as Pathfinder Demo → panel auto-opens to menu. **Three** cards in order: Roadmaps (5 steps), Journal (5 steps), Jobs (4 steps). Journal card uses violet icon tile + BookOpen icon + tagline "Daily entries: mood, events, references."
2. Click the Journal card → in-section view: header "Journal · 0 / 5", `← All tutorials` link visible. First step "Today at a glance" focused; floating callout sparkle anchors near the dashboard's Today's journal card.
3. Mark step 1 complete (click its circle). Step 2 "Open your journal" focused; callout jumps to the Journal nav link.
4. Click the "Open Journal" CTA → URL becomes `/journal?date=…`; step 2 auto-completes via `nextOnPath: '/journal'`. (URL matching is on pathname, not full URL — `/journal?date=…` matches `'/journal'`.) Step 3 "Set the mood" focused; callout anchors near the MoodPicker.
5. Mark steps 3, 4, 5 manually (or via clicking around). After step 5 lands, panel auto-returns to menu after the 200ms beat; Journal card now shows "Done ✓ · Re-run →".
6. Click Journal "Re-run" → all five Journal steps reset; panel reopens to step 1.
7. Click Restart in panel footer → all three sections reset, navigates to `/`, menu visible with three "Start →" cards.
8. From the menu, close panel via X. Click the floating "Resume tour" button → reopens to menu (since that's where the user was).

## Open Questions

None.
