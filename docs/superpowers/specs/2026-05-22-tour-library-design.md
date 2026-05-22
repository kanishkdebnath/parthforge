# Tour Library — Design

*2026-05-22*

## Purpose

Replace the always-flat tour panel with a "tutorial library" — a menu of per-section tutorial cards the user can pick from individually. Currently the panel auto-opens with all 9 steps (Roadmaps + Jobs) visible at once; users have no choice over what to learn, and the panel will only get more crowded as the Journal tutorial is added next. The library inverts the model: the panel opens to a menu, the user clicks a section, that section's steps render in isolation, and completion returns to the menu.

This is the foundation for the next branch, which adds a Journal tutorial as a third section on the same menu. By landing the library first, the Journal tutorial drops in as a fourth illustrated card without any structural change to the panel.

## Goals

- Demo user sees a menu of section tutorial cards on auto-open (Roadmaps + Jobs today).
- Clicking a card opens that section's step list in the panel; the menu and other sections are not shown.
- Each section card surfaces its status: "Not started" + step count, "X of N · Continue", or "Done ✓ · Re-run".
- "Re-run" on a completed section resets *only* that section's completion and starts it over.
- When a section's last step is marked complete, the panel auto-returns to the menu.
- "Restart" in the panel footer resets *all* sections and returns to the menu (existing semantic, scoped).
- Floating "Resume tour" button preserves the user's position — menu or in-section.
- `TourCallout` floating bubble renders only while a section is active (no callouts on the menu).
- Path-based auto-advance (`nextOnPath` on a step) only fires when its step's group is the active section.

## Non-Goals

- Generalizing the tour to non-demo users.
- Persisting tutorial completion across sessions (still in-memory; demo data wipes on every demo login).
- Adding the Journal tutorial section. That's the next branch, dropping in as another card.
- Restyling the in-section step list — same checkboxes, CTAs, and "Mark complete" buttons as today.
- Multi-select / batch tutorial runs (the library model is one-at-a-time).
- A "Run all" shortcut from the menu.

## Architecture

```
                  Demo user login
                         │
                         ▼
              ┌──────────────────────┐
              │ TourProvider mounts  │
              │ activeSection = null │  ← menu
              └──────────┬───────────┘
                         │
                         ▼
            ┌──────────────────────────┐
            │ TourPanel (auto-open)    │
            │ ┌──────────────────────┐ │
            │ │  Pathfinder tutorials│ │
            │ │  ┌──────────────────┐│ │
            │ │  │ 🗺️ Roadmaps      ││ │  click → openSection('Roadmaps')
            │ │  │ 5 steps · Start →││ │
            │ │  └──────────────────┘│ │
            │ │  ┌──────────────────┐│ │
            │ │  │ 💼 Jobs          ││ │  click → openSection('Jobs')
            │ │  │ 2 of 4 · Continue││ │
            │ │  └──────────────────┘│ │
            │ └──────────────────────┘ │
            │ [Restart]                │
            └──────────┬───────────────┘
                       │
                       ▼ (user clicks a section)
            ┌──────────────────────────┐
            │ TourPanel (in-section)   │
            │ ← All tutorials          │
            │ Roadmaps   3 / 5         │
            │ ☑ Browse your roadmaps   │
            │ ☑ Open in-progress one   │
            │ ☑ Toggle a step          │
            │ ○ Reorder milestones     │
            │ ○ Import from LLM        │
            │ [Restart]                │
            └──────────┬───────────────┘
                       │
                       ▼ (last step marked complete → 200ms beat)
                  Back to menu
                  (card now shows "Done ✓ · Re-run")
```

## Load-Bearing Rules Respected

- **No data-model changes.** Tour state stays in-memory on the React provider; no backend, no Mongo, no schema changes.
- **Demo-user scope preserved.** `if (!isDemoUser) return null` in the panel is unchanged.
- **Existing `data-tour` attributes** on UI targets are unchanged. The `TourCallout` continues to anchor near them when a section is active.
- **No new dependencies.**

## Tour Provider — State & Actions

### Current shape (recap)

```ts
type TourContextValue = {
  isDemoUser: boolean;
  open: boolean;
  completedStepIds: Set<string>;
  currentStepId: string | null;
  currentStep: TourStep | null;
  openPanel: () => void;
  closePanel: () => void;
  restart: () => void;
  markComplete: (id: string) => void;
};
```

### New shape

```ts
type TourContextValue = {
  isDemoUser: boolean;
  open: boolean;
  completedStepIds: Set<string>;

  /** null = on the menu, group name = in that section's step list */
  activeSection: TourStepGroup | null;
  /** The currently-focused step within the active section (null on menu). */
  currentStepId: string | null;
  currentStep: TourStep | null;

  /** Per-section status used by the menu cards. */
  sectionStatus: (group: TourStepGroup) => {
    total: number;
    completed: number;
    state: 'not-started' | 'in-progress' | 'done';
  };

  openPanel: () => void;
  closePanel: () => void;
  /** Open a section's tutorial. If status is 'done' and resetIfDone is true,
   *  clears that section's completion before opening (the "Re-run" path). */
  openSection: (group: TourStepGroup, opts?: { resetIfDone?: boolean }) => void;
  /** Return to the menu without losing per-section progress. */
  backToMenu: () => void;

  restart: () => void;
  markComplete: (id: string) => void;
};
```

### Behavior

- `openSection(group, opts)`:
  - If `opts?.resetIfDone` and the group is done, remove every step ID in the group from `completedStepIds` first.
  - Set `activeSection = group`.
  - Set `currentStepId` to the first uncompleted step in the group (or the first step if all reset).
- `backToMenu()`: set `activeSection = null`. `currentStepId` stays at the last focused step in that group so re-entering picks up where the user left off.
- `markComplete(id)`:
  - Add `id` to `completedStepIds`.
  - If `activeSection !== null` and every step in that group is now complete, schedule `setActiveSection(null)` after 200ms so the user sees the last checkmark land before the menu reappears.
  - Otherwise, advance `currentStepId` to the next uncompleted step *within `activeSection`* (not cross-section).
- `restart()`: clear all `completedStepIds`, set `activeSection = null`, `currentStepId = TOUR_STEPS[0]?.id ?? null`, navigate to `/`. Same as today except now lands on the menu instead of step 0.
- Path-based auto-advance (existing effect that watches `location.pathname` against `nextOnPath`): becomes a no-op when `activeSection === null` or when the matched step's group ≠ `activeSection`.

`sectionStatus(group)` is a pure derivation over `TOUR_STEPS` and `completedStepIds` — exported so the panel doesn't reimplement the count math.

## Tour Panel — Two Views

### Header

| Mode | Title | Sub-line |
|---|---|---|
| Menu (`activeSection === null`) | "Pathfinder tutorials" | "Pick a section to learn" |
| In-section | the section name (e.g., "Roadmaps") | "X / N this section" |

The in-section header also renders a "← All tutorials" link (calls `backToMenu()`).

### Menu body

For each `TourStepGroup` (currently `'Roadmaps' | 'Jobs'`, in the next branch `+ 'Journal'`), an illustrated card:

```
┌────────────────────────────────────┐
│ ┌──┐                               │
│ │🗺️│  Roadmaps                     │
│ └──┘  Goals broken into milestones │
│       with steps.                  │
│ ─────────────────────────────      │
│ 5 steps                Start →     │
└────────────────────────────────────┘
```

| Section | Icon | One-liner |
|---|---|---|
| Roadmaps | 🗺️ | Goals broken into milestones with steps. |
| Jobs     | 💼 | Track applications, rounds, and outcomes. |
| Journal (next branch) | 📓 | Daily entries: mood, events, references. |

Status text + CTA depend on `sectionStatus(group)`:

| State | Status text | CTA |
|---|---|---|
| not-started | "N steps" | "Start →" |
| in-progress | "X of N" | "Continue →" |
| done | "Done ✓" (green) | "Re-run →" |

The whole card is the click target. For done sections, the click handler is `openSection(group, { resetIfDone: true })`; for others, just `openSection(group)`.

### In-section body

The current step-list rendering, filtered to `step.group === activeSection`. Each step item keeps its existing UI: checkbox / checkmark, title, body, optional CTA link, "Mark complete" button. No structural change inside the list.

### Footer

- "Restart" button (existing) — now resets all sections + returns to menu (current behavior was: clears completion, advances to step 0, navigates to `/`; the only change is the "step 0" semantic becomes "menu").
- "Close" button (existing) — unchanged.

## Floating Resume & Callout

### "Resume tour" floating button

Visible when `!open && isDemoUser`. Clicking calls `openPanel()`. Whatever view (`activeSection`) the user was last on persists, so reopening lands them back where they were.

### `TourCallout` (floating bubble that anchors near `data-tour` targets)

Renders only when:
1. `open === true`
2. `activeSection !== null`
3. `currentStep?.target` exists
4. The DOM has a match for `currentStep.target`

When on the menu (`activeSection === null`), no callout — the user is browsing the library, not following a step.

## Error Handling

- **A section has zero steps** (shouldn't happen, but if it does): the card renders with "0 steps · Start →" disabled. `openSection` is a no-op.
- **Restart while in-section**: same as restart from menu — clears all completion, returns to menu, navigates to `/`.
- **markComplete on a step that doesn't belong to active section**: defensive — still marks it complete (consumer might mark via path auto-advance or external trigger), but doesn't change `activeSection` or `currentStepId`.

## Testing

No automated frontend tests (matches project posture). Manual smoke through `docker compose up`:

1. Log in as Pathfinder Demo → panel auto-opens to the menu. Two illustrated cards visible: Roadmaps (5 steps · Start →) and Jobs (4 steps · Start →).
2. Click Roadmaps → in-section view: header "Roadmaps · 0 / 5", 5 step items, "← All tutorials" link visible.
3. Mark 3 steps complete → header reads "3 / 5". Click "← All tutorials" → menu shows "Roadmaps · 3 of 5 · Continue →".
4. Click Roadmaps again → opens to the first uncompleted step (not back at step 0).
5. Mark the remaining 2 → after 200ms, panel returns to menu. Roadmaps card now reads "Done ✓ · Re-run →".
6. Click Roadmaps card while done → step list reopens with all 5 unchecked.
7. Open Jobs, mark 2/4, close panel via X. Floating "Resume tour" button appears → click → panel reopens to Jobs in-section (not menu).
8. Click "Restart" → all sections reset, navigated to `/`, lands on menu, both cards show "Start →".

## Open Questions

None.
