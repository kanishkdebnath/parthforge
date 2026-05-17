# Roadmaps Frontend Redesign — Design

**Status:** approved
**Date:** 2026-05-18
**Supersedes:** [2026-05-17-roadmaps-feature-design.md](2026-05-17-roadmaps-feature-design.md) (Editorial Manuscript aesthetic — shipped 2026-05-17, judged too dense / hard to navigate)

## Why a redesign

The Editorial Manuscript direction (Fraunces serif, slate/amber/lime/rose, M.NN numbered milestones, drop caps, paper grain, inline-editing-everywhere, hover-revealed kebabs) shipped 26 commits across three weeks but missed on two fronts when the user actually lived with it:

1. **Look** — the serif + amber + paper grain combination read as dated/literary rather than modern. The signature details (drop caps, RM.NN counters, italic dates) added visual noise without earning their place.
2. **Flow** — inline-edit-everywhere meant the user couldn't tell where to click to do what. Hover-revealed kebabs and drag handles hid common actions like "delete a roadmap" so well that the user reported "there's no option to delete" after the feature shipped with delete fully implemented inside a kebab.

The data model, API, and hooks layer stay. Only the visual layer and the interaction patterns change.

## Settled Decisions (chosen via live mockup walk in browser)

| Topic | Decision | Why |
|---|---|---|
| Visual direction | **Stripe / Apple** — soft, spacious, friendly. Inter throughout, no serifs. Sky accent (`#0ea5e9`) + emerald done (`#10b981`) + rose overdue (`#dc2626`) on a slate baseline. Soft 12–14px rounded corners, generous whitespace, subtle shadows. | Modern + approachable, not corporate-dashboard. The user picked this over a Linear/Geist direction in a side-by-side comparison. |
| Detail page layout | **Two-column with left sidebar.** Roadmap title, description, large ring progress, and stacked action buttons (Edit details · Archive · Delete forever) all dock on the left rail. Right panel is the milestone list. | Roadmap meta and actions stay visible while you scroll the milestone list. The user's "no delete option" complaint was specifically about delete being buried in a kebab; in this layout, Delete is a labelled button on the left rail — impossible to miss. |
| List page layout | **Card grid.** Gradient icon tile + title + description excerpt + ring progress + milestone count per card. 3-column on lg, 2 on md, 1 on sm. Same Stripe/Apple language. | Picked in the first mockup comparison. Card density matches the friendly tone; gradient icons are a small flourish that adds character without going gimmicky. |
| Milestone card behavior | **Always-expanded steps** inside each card, with an optional chevron to collapse. Drag handle always visible on the milestone (gripped icon in the gutter); hover-revealed on individual steps. `+ add a step…` is the last row inside each card. `+ Add milestone` is a dashed button at the bottom of the milestone list. | "See your work at a glance" beats "click to reveal" for a goal tracker. The chevron lets a user collapse long milestones if they want — but the default is open. |
| Edit interactions | **Hybrid.** Inline for the two highest-frequency single-field actions: (a) toggling a step's checkbox, (b) renaming a title (click → input → Enter saves). Modal for everything multi-field: new roadmap, new milestone with description + deadline, edit step links, edit milestone description + deadline together. | Inline-everywhere (the previous version) made affordances invisible. Modal-everywhere (the cleanest option) made cheap actions expensive. Hybrid keeps each action proportional to its cost. |

## Visual brief

### Typography
- **Single font: Inter** loaded via Google Fonts. Variable weights 400/500/600/700. Sans serif throughout — no Fraunces, no Georgia, no system serif fallback.
- Numerals: tabular only on counters and percentages (`font-variant-numeric: tabular-nums`).
- No small caps. No drop caps. No italic-Fraunces dates. Dates render plainly: `Jul 16`, `Dec 31`, `2027`.
- Sizes scale by surface:
  - List page h1: `text-3xl` (30px) `font-bold` `tracking-tight`
  - Detail sidebar title: `text-xl` (20px) `font-bold`
  - Milestone titles: `text-base` (15px) `font-semibold`
  - Step titles: `text-sm` (13px) `font-medium`

### Color tokens
Defined as Tailwind semantic tokens, all sky-derived for the accent so the system reads as a single palette:

```ts
// tailwind.config.ts theme.extend.colors
brand: {
  DEFAULT: '#0ea5e9',          // sky-500 — primary accent
  hover:   '#0284c7',          // sky-600
  subtle:  '#e0f2fe',           // sky-100 — backgrounds
  ring:    '#bae6fd',           // sky-200 — focus rings
},
done: {
  DEFAULT: '#10b981',          // emerald-500
  subtle:  '#d1fae5',          // emerald-100
},
overdue: {
  DEFAULT: '#dc2626',          // red-600
  subtle:  '#fee2e2',          // red-100
},
// shadcn baseline (slate) tokens stay as-is for background/foreground/border/etc.
```

The amber `active` and lime `done` tokens from the previous redesign are removed.

### Spacing & shape
- Card corner radius: `rounded-xl` (12px) for roadmap cards and milestone cards. `rounded-2xl` (16px) for the largest hero containers (sidebar wrapper, detail-page main panel). `rounded-lg` (8px) for inline controls.
- Card padding: `p-5` (20px) for milestone cards, `p-6` for list cards.
- Card shadow: `shadow-sm` (subtle 1px) at rest. `shadow-md` on drag.
- Page padding: `py-10 px-8` on the detail layout shell. `py-12` on the list page.
- Card gap in the grid: `gap-5` (20px).

### Backgrounds
- App background: `bg-slate-50` (`#f8fafc`) on the body — soft gray, not pure white.
- Card backgrounds: pure white.
- No paper-grain. No SVG noise textures.
- Page-level soft gradient on the detail page only: `bg-gradient-to-b from-white via-slate-50 to-slate-50`. Subtle, decorative.

### Iconography
- `lucide-react` (already installed). Specific icons: `Pencil` (edit), `Archive`, `Trash2` (delete), `GripVertical` (drag handle), `Check`, `Plus`, `ChevronDown`/`ChevronRight` (collapse), `MoreHorizontal` (only on step rows for the rare "manage links / delete step" action), `Link` (link chip prefix), `X` (close modal).
- Gradient icon tiles on roadmap cards: 36×36px `rounded-xl` div with `bg-gradient-to-br from-brand to-indigo-500` for in-progress roadmaps. Switches to `from-done to-emerald-600` when 100%. No icon glyph inside — it's a pure decorative tile.

### Motion
- Ring progress fills animate with a 300ms ease-out transition.
- Card stagger on list mount: 50ms × index (kept from previous spec — felt good).
- Checkbox toggle: 150ms color transition. No CSS strike-through animation (just color + line-through; the animation was distracting at the previous duration).
- Modal open: `motion`-driven fade + scale (0.96 → 1.0) over 180ms.
- Drag in flight: card `scale-[1.02]` + `shadow-md` (lighter than before).

## Layout: List page (`/roadmaps`)

```
┌─────────────────────────────────────────────────────────────────┐
│  Pathforge      Roadmaps                                  [👤]   │  ← Existing navbar (already
├─────────────────────────────────────────────────────────────────┤    correctly font-changed)
│                                                                 │
│   Roadmaps                                  [+ New roadmap]    │  ← h1 + primary button
│   Three pursuits in motion.                                     │  ← description line
│                                                                 │
│   [Active] Archived           [🔍 Search roadmaps…]            │  ← segmented control + search
│                                                                 │
│   ┌────────────┐  ┌────────────┐  ┌────────────┐               │
│   │ 🟦 Tile    │  │ 🟦 Tile    │  │ 🟩 Tile    │               │
│   │ Learn Rust │  │ Run a half │  │ Read 12 b. │               │
│   │ short desc.│  │ short desc.│  │ short desc.│               │
│   │  (•33%)    │  │  (•60%)    │  │  (✓100%)   │               │
│   │ 3 milestones│ │ 2 milestones│ │ 1 milestone│               │
│   └────────────┘  └────────────┘  └────────────┘               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Component tree (file structure):**

```
src/components/roadmaps/
├── ListPageHeader.tsx       (h1 + description + "+ New roadmap" button)
├── ListPageToolbar.tsx      (segmented control [Active|Archived] + search input)
├── RoadmapCardGrid.tsx      (motion-staggered grid)
├── RoadmapCard.tsx          (card with icon tile, title, desc, ring, count)
├── EmptyState.tsx           (when no roadmaps exist)
├── NoResultsState.tsx       (when search query has no matches)
└── NewRoadmapDialog.tsx     (modal, title + description + optional deadline)
```

The existing `RoadmapsListPage`, `RoadmapsToolbar`, `RoadmapCardGrid`, `RoadmapCard`, `EmptyRoadmapsState`, `NoResultsState`, `NewRoadmapDialog` files all get rewritten in place — same file paths.

**`RoadmapCard` shape:**

```tsx
<Link to={`/roadmaps/${roadmap._id}`} className="block bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow group">
  <div className="flex items-start gap-4 mb-4">
    <div className={cn(
      "h-9 w-9 rounded-xl shrink-0",
      isDone ? "bg-gradient-to-br from-done to-emerald-600" : "bg-gradient-to-br from-brand to-indigo-500"
    )} />
    <div className="min-w-0 flex-1">
      <h3 className="text-base font-semibold tracking-tight text-slate-900 group-hover:text-slate-950 truncate">{roadmap.title}</h3>
      {roadmap.description && (
        <p className="mt-1 text-sm text-slate-600 line-clamp-2">{roadmap.description}</p>
      )}
    </div>
  </div>
  <div className="flex items-center justify-between">
    <RingProgress pct={pct} done={isDone} />
    <div className="text-xs text-slate-500 tabular-nums">{milestoneCount} {pluralize(milestoneCount, "milestone")}</div>
  </div>
</Link>
```

**`RingProgress` is a new shared component**: a 28×28 conic-gradient circle showing percentage, with the numeric value (or `✓` when 100%) centered. Lives at `src/components/roadmaps/RingProgress.tsx`. Reused by `RoadmapCard` and the sidebar's larger 96×96 version.

## Layout: Detail page (`/roadmaps/:id`)

```
┌─────────────────────────────────────────────────────────────────┐
│  Pathforge      Roadmaps                                  [👤]   │
├──────────────────────────┬──────────────────────────────────────┤
│                          │                                       │
│  ← Roadmaps              │   Milestones                         │
│                          │                                       │
│  Learn Rust              │   ┌────────────────────────────┐    │
│  From the book to        │   │ ⋮⋮  ⊙ Foundation  1/4  ▾  │    │
│  tokio. Building         │   │     ▢ Read chapter 1 ✓     │    │
│  muscle memory.          │   │     ▢ Read chapter 2       │    │
│                          │   │     ▢ Run cargo test       │    │
│       ╭───────╮          │   │     ▢ Build a CLI tool     │    │
│       │  33%  │          │   │     ▢ add a step…           │    │
│       ╰───────╯          │   └────────────────────────────┘    │
│  3 of 9 steps            │                                       │
│  due dec 31              │   ┌────────────────────────────┐    │
│                          │   │ ⋮⋮  ○ Ergonomics  0/3  ▾  │    │
│  ✎ Edit details          │   │     ▢ Learn lifetimes      │    │
│  ⊟ Archive               │   │     ▢ Practice traits      │    │
│  🗑 Delete forever        │   │     ▢ Write a macro        │    │
│                          │   │     ▢ add a step…           │    │
│                          │   └────────────────────────────┘    │
│                          │                                       │
│                          │   ┌────────────────────────────┐    │
│                          │   │ + Add milestone            │    │
│                          │   └────────────────────────────┘    │
│                          │                                       │
└──────────────────────────┴──────────────────────────────────────┘
```

**Component tree:**

```
src/components/roadmaps/
├── DetailPageShell.tsx          (the 2-column grid; left = sidebar, right = main)
├── RoadmapSidebar.tsx           (title + desc + ring + actions)
├── RoadmapActions.tsx           (Edit details / Archive / Delete forever — vertical stack)
├── EditRoadmapDialog.tsx        (modal: title + description + deadline; opens from sidebar "Edit details")
├── DeleteRoadmapConfirm.tsx     (modal: confirm + step/milestone count + danger button)
├── MilestoneList.tsx            (dnd-kit SortableContext for milestones)
├── MilestoneCard.tsx            (header: grip + ring + title + count + chevron; body: step list + add row)
├── EditMilestoneDialog.tsx      (modal: title + description + deadline; opens from milestone overflow menu)
├── StepList.tsx                 (nested dnd-kit SortableContext for steps)
├── StepRow.tsx                  (grip-on-hover + checkbox + title + link chips + overflow menu)
├── EditStepLinksDialog.tsx      (modal: list of links + add/remove/edit URL+label form)
├── AddMilestoneInline.tsx       (dashed "+ Add milestone" button → opens NewMilestoneDialog)
├── NewMilestoneDialog.tsx       (modal: title + optional description + optional deadline)
└── AddStepInline.tsx            (last-row "+ add a step…" input — Enter saves)
```

**`RoadmapSidebar` layout (left rail of the detail page):**

```tsx
<aside className="w-[280px] shrink-0 p-8 sticky top-16 self-start">
  <Link to={roadmap.archived ? '/roadmaps/archived' : '/roadmaps'} className="text-sm text-slate-500 hover:text-slate-900 mb-8 flex items-center gap-1">
    <ArrowLeft className="h-3.5 w-3.5" /> {roadmap.archived ? 'Archive' : 'Roadmaps'}
  </Link>
  <h1 className="text-xl font-bold tracking-tight mb-2">{roadmap.title}</h1>
  {roadmap.description && (
    <p className="text-sm text-slate-600 mb-6 leading-relaxed">{roadmap.description}</p>
  )}
  <RingProgress pct={pct} size="large" />
  <div className="text-xs text-slate-500 text-center mt-2">
    {done} of {total} steps {roadmap.deadline && <span>· due {formatDeadline(roadmap.deadline)}</span>}
  </div>
  {isOverdue && <div className="mt-3 text-xs text-overdue text-center">Past deadline</div>}
  <div className="mt-8 space-y-1">
    <button onClick={...}><Pencil />Edit details</button>
    <button onClick={...}><Archive />{roadmap.archived ? 'Unarchive' : 'Archive'}</button>
    <button onClick={...} className="text-red-700"><Trash2 />Delete forever</button>
  </div>
</aside>
```

Buttons are full-width left-aligned with icon + label, ~36px high. `bg-transparent` at rest, `bg-slate-100` on hover. The delete button uses `text-red-700` at rest and `bg-red-50` on hover.

On screens narrower than 1024px (Tailwind `lg:`), the sidebar collapses to the top of the page above the milestone list (single column), and the actions become an inline action row instead of a stack. This is a v1 concession — the primary target is desktop.

## Interaction patterns

### Inline title editing (the highest-frequency edit)

Click any title (roadmap title in sidebar, milestone title in card header, step title in row). The element becomes a focused `<input>` with the value selected. **Enter** or **blur** saves via the relevant `useUpdate*` mutation. **Escape** reverts. Same `settledRef` guard as today to prevent double-fire.

Affordance on hover: a 1px slate-200 underline appears under the title to signal it's clickable. Cursor becomes `text`.

### Checkbox toggle (the second-highest-frequency)

Click anywhere on a step row's checkbox. The step's `completed` toggles. Strike-through and slate-400 text color animate over 150ms. Optimistic (already handled by `useUpdateStep`). Same row hover state stays for a moment so the user can verify the change.

### Modal-driven multi-field edits

Five modal dialogs:

| Modal | Triggered by | Fields |
|---|---|---|
| `NewRoadmapDialog` | "+ New roadmap" button (list page header) | title (required), description, deadline |
| `EditRoadmapDialog` | "Edit details" button (detail sidebar) | title, description, deadline — pre-populated |
| `NewMilestoneDialog` | "+ Add milestone" dashed button (detail page) | title (required), description, deadline |
| `EditMilestoneDialog` | "Edit milestone" item in milestone overflow menu | title, description, deadline — pre-populated |
| `EditStepLinksDialog` | "Edit links" item in step row overflow menu | list of `{url, label?}` with add/remove/reorder |

All five share the same `<Dialog>` shell — header (title + subtitle), body (form), footer (Cancel ghost button + primary Save button). The primary save uses `bg-brand` background. All forms validate inline; the Save button stays disabled while required fields are empty or while a mutation is in flight.

Pressing **Escape** or clicking the scrim or the **Cancel** button discards changes and closes the dialog. The dialog clears its draft state on close (the bug from the previous spec where state leaked is preserved-fixed here too).

### Confirm-delete

`DeleteRoadmapConfirm` opens when the user clicks "Delete forever" in the sidebar. Shows the roadmap title, total milestones, and total steps that will be destroyed. Cancel button (ghost) and "Delete forever" button (`bg-red-600 text-white`). Both disabled while mutation pending. Same pattern as the previous spec — proven to work — just restyled.

Milestone delete uses a smaller variant `DeleteMilestoneConfirm` available from the milestone overflow menu.

Step delete is direct (no confirm) since it's recoverable by re-adding. Lives in the step row's overflow menu.

### Drag-and-drop

`@dnd-kit/sortable` (unchanged from the previous implementation). Two `SortableContext`s — one for the milestone list, one nested per milestone for steps.

**Visible affordance changes:** the milestone drag handle is always visible in the left gutter of each milestone card (a small `GripVertical` icon, slate-300 at rest, slate-500 on hover). The step drag handle stays hover-revealed (the step row is dense enough that an always-visible handle would feel cluttered).

### Search and filter

Same client-side substring search across title + description + milestone titles. Lives in the `ListPageToolbar`. The Active/Archived control becomes a **segmented control** (two pill buttons with a sliding indicator under the selected one) instead of the previous slash-separated text links — clearer affordance.

## Out of scope for this redesign

These are intentionally NOT being changed:

- **Backend, data model, API contract, Zod schemas.** All shipped backend stays.
- **Hooks layer** (`useRoadmaps.ts`). The 14 hooks and their cache keys keep working as-is.
- **Routes.** `/roadmaps`, `/roadmaps/archived`, `/roadmaps/:id` unchanged.
- **Navbar.** Already uses Inter and looks clean — kept as-is, just confirming the Fraunces import / `font-display` token gets removed cleanly.
- **Drag-and-drop library.** `@dnd-kit/sortable` stays.
- **Motion library.** `motion` stays (used by card stagger).
- **Toaster.** `sonner` stays.
- **Optimistic mutation behaviors.** All three (step toggle, milestone reorder, step reorder) stay optimistic per the hooks layer.
- **Acceptance test scope.** Still Playwright-driven, no React Testing Library / vitest cases added.

## Cleanup plan

The previous implementation lives across many files. The redesign needs to:

1. **Remove** unused tokens and CSS from `tailwind.config.ts` and `src/index.css`: `active.*`, `done.*`, `overdue.*` (old amber/lime/rose), `.smcp`, `.tabular` (replaced by Tailwind's `tabular-nums`), `.dropcap`, `.link-chip`, `.paper-grain`, `font-display` (Fraunces). Replace with new `brand`/`done`/`overdue` tokens (sky/emerald/red).
2. **Remove** the Fraunces font load from `apps/web/index.html` (`<link>` to Google Fonts). Inter is system/Tailwind default — no font load needed.
3. **Rewrite** every file under `apps/web/src/components/roadmaps/` to the new shapes listed above. Same file paths so imports don't break across pages.
4. **Rewrite** `apps/web/src/components/InlineEditable.tsx` — only the `InlineEditableTitle` survives; `InlineEditableText` and `InlineEditableDate` are no longer used (multi-field edits move to modals). Simpler API, smaller file.
5. **Rewrite** `apps/web/src/pages/RoadmapsListPage.tsx` and `apps/web/src/pages/RoadmapDetailPage.tsx` to use the new shell components.
6. **Add** the new `RingProgress` shared component at `src/components/roadmaps/RingProgress.tsx`.
7. **Update** `apps/web/src/components/Navbar.tsx` to remove the `font-display` class and the Fraunces `fontVariationSettings` style.

`packages/shared`, `apps/api`, and every hook in `apps/web/src/hooks/useRoadmaps.ts` are untouched.

## Implementation handoff

The implementation plan (next step) will sequence the work along these lines, but the writing-plans skill decides the actual decomposition:

1. Foundation: theme tokens replaced, Fraunces removed, font load cleaned up.
2. `RingProgress` shared component.
3. `RoadmapCard` + `RoadmapCardGrid` (list page right half).
4. `ListPageHeader` + `ListPageToolbar` + new `NewRoadmapDialog` (modal pattern).
5. `RoadmapsListPage` rewrite.
6. `RoadmapSidebar` + `RoadmapActions` + `EditRoadmapDialog` + `DeleteRoadmapConfirm`.
7. `MilestoneCard` + `MilestoneList` + `EditMilestoneDialog` + `NewMilestoneDialog` + add-inline pattern.
8. `StepList` + `StepRow` + `AddStepInline` + `EditStepLinksDialog`.
9. `RoadmapDetailPage` rewrite (mounts sidebar + milestone list).
10. Cleanup: delete dead `InlineEditableText`/`InlineEditableDate`, dead CSS utilities, dead tokens.
11. Acceptance walk + screenshots + PROJECT.md changelog.

End state: same feature, same data, completely different surface. The user's "no delete option" complaint and "looks very bad" complaint are both directly addressed: delete is a visible labelled button in the sidebar, the look is the Stripe/Apple direction picked from real mockups.
