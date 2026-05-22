# Budget — Design

*2026-05-22*

## Purpose

Add a fourth top-level feature to Pathforge: **Budget**, a manual-entry personal-finance tracker for soft monthly category targets and a retrospective month-end report. Users define category groups (Bills, Household, Debt, Leisure, Savings, Income, etc.) and child categories, log transactions as they happen via a single hero input row, and look back at month-end to see how the actual shape of the month compared to the intended shape. The differentiator vs. existing budgeting apps is positioning, not feature surface: Budget rides inside the same dashboard as Roadmaps, Jobs, and Journal, sharing identity and habit-loop infrastructure rather than asking users to context-switch to a separate tool.

## Goals

- One coherent place to log every transaction in ~10 seconds: amount, kind (income/expense), category, optional date/time/description.
- A two-column current-month view (green incomes left, red expenses right) gives an instant read of the month's shape.
- Soft monthly targets per category — adjustable any time, never policed in real time, preserved historically so retrospective reports stay trustworthy across target changes.
- A month-end retrospective report that surfaces target-vs-actual at both group and category level, plus a one-line narrative summary.
- Recurring transaction templates (monthly cadence, opt-in apply) cover rent/salary/subscriptions without auto-creating surprise entries.
- A dashboard widget brings month-to-date headline numbers and a top-categories readout into the existing dashboard grid.
- Currency is per-user, default `INR`, user-changeable in profile.

## Non-Goals

- Bank/financial-institution integration (Plaid, Teller, MX, Open Banking). Manual entry only.
- CSV/statement import. Manual entry only.
- Per-account modeling, transfers between accounts, reconciliation, net-worth tracking.
- Liabilities (credit cards with statement cycles, loans with amortization) and investment value tracking.
- Multi-currency on a single user, FX conversion, historical exchange rates.
- Tags on transactions, transaction splits, attachments/receipts.
- Cross-period budgets (weekly, quarterly), rollover/envelope balances.
- Spend alerts, push notifications, threshold warnings.
- Cross-feature integration with Roadmaps or Jobs in v1 (deferred to a phase 2; load-bearing fields are designed to allow it later without migration).
- Sharing, household budgets, multi-user collaboration on a single budget.
- LLM-generated narrative or insights in v1. The month-end narrative is template-generated server-side.

## Architecture

```
                 Budget feature
                       │
        ┌──────────────┼─────────────────┬──────────────────┐
        ▼              ▼                 ▼                  ▼
   /budget        /budget/plan      /budget/report   /budget/categories
   (log + input)  (set targets)     (retrospective)  /budget/recurring
        │              │                 │                  │
        └──────────────┴─────────────────┴──────────────────┘
                       │
                       ▼
              Shared budget hooks
              (TanStack Query: useBudgetTransactions, useBudgetTargets,
               useBudgetCategories, useBudgetGroups, useBudgetReport,
               useBudgetRecurring, useBudgetSummary)
                       │
                       ▼
              /api/budget/*  (Fastify routes, auth-required)
                       │
                       ▼
              Mongoose models (4 new collections)
              + 1 field added to existing users collection
```

Dashboard integration:
```
            Dashboard secondary widget grid
            ┌──────────────┬──────────────┬──────────────┐
            │ RoadmapsWidget │ JobsWidget │ BudgetWidget │
            └──────────────┴──────────────┴──────────────┘
                                              │
                                              ▼
                                       useBudgetSummary(currentMonth)
                                              │
                                              ▼
                                    GET /api/budget/report?month=
```

## Load-Bearing Rules Respected

- **`packages/shared` keystone.** Every domain shape (`BudgetCategoryGroup`, `BudgetCategory`, `BudgetTransaction`, `BudgetTarget`, `BudgetRecurringTemplate`) is a Zod schema in `packages/shared/src/budget.ts`, imported by both the API (request validation, Mongoose model alignment) and the web app (form validation, inferred TS types). No duplicate shapes.
- **`userId` on every collection.** All four new collections carry `userId`; every query filters by it; every compound index starts with it.
- **Auth shape unchanged.** All `/api/budget/*` routes go through the existing cookie-session middleware; `req.user.userId` scopes every query. No new auth surface, no new session shape.
- **Axios `withCredentials: true` preserved.** Budget hooks reuse the existing axios client; no new HTTP client setup.
- **TanStack Query owns server state.** All budget data lives behind query keys: `['budget', 'groups']`, `['budget', 'categories']`, `['budget', 'transactions', month]`, `['budget', 'targets', month]`, `['budget', 'report', month]`, `['budget', 'recurring']`. Mutations invalidate the relevant keys; no parallel state store.
- **Protected routing via `<RequireAuth>`.** `/budget/*` routes are wrapped, matching the rest of the app.
- **Aesthetic continuity.** Inter throughout, sky/emerald/red palette (emerald for income, red for expense fits naturally). Reuses the existing shadcn/ui set (Button, Card, Input, Select, Dialog, DropdownMenu, Tabs).

## Data Model

Four new collections plus one field on `users`.

### `users` (modification)
Add a single field:
```ts
{
  // ...existing fields
  currency: string,        // ISO 4217, default 'INR'
}
```
Settable via a small extension to the existing user-update route (see API section). Single-currency throughout v1; changing currency does not retroactively convert past amounts.

### `budgetCategoryGroups`
The user's catalog of group buckets. Built once, edited occasionally.
```ts
{
  _id, userId,
  name: string,            // "Bills", "Household", "Income", "Debt", ...
  color: string,           // 6-char hex with leading '#'
  order: number,           // user-controlled display order
  archived: boolean,       // soft delete
  createdAt, updatedAt,
}
```
Indexes:
- `{ userId, archived, order }` — primary list view.
- `{ userId, name }` unique compound (case-insensitive at the app layer).

Seeded on first visit with: *Income, Bills, Household, Debt, Leisure, Savings, Other*. Seeding is one-shot — deleting all groups won't re-seed.

### `budgetCategories`
Leaf categories that transactions attach to.
```ts
{
  _id, userId,
  groupId,                 // ref to budgetCategoryGroups
  name: string,            // "Salary", "Groceries", "Rent", ...
  kind: 'income' | 'expense',
  color?: string,          // optional override; falls back to group's color
  order: number,           // scoped within group
  archived: boolean,
  createdAt, updatedAt,
}
```
Indexes:
- `{ userId, groupId, archived, order }` — primary list view, grouped.
- `{ userId, name }` unique compound (case-insensitive).
- `{ userId, archived, kind }` — feeds the input row's category dropdown.

Seeded alongside the default groups with a small starter set: *Salary* (Income), *Rent* (Bills), *Electricity* (Bills), *Groceries* (Household), *Dining* (Leisure), *Transport* (Household).

### `budgetTargets`
One row per category per month. Independent per month — preserves historical targets.
```ts
{
  _id, userId,
  categoryId,              // ref to budgetCategories
  month: string,           // "YYYY-MM"
  amount: number,          // positive integer minor units (paise)
  createdAt, updatedAt,
}
```
Indexes:
- `{ userId, month, categoryId }` unique compound — one target per category per month.
- `{ userId, categoryId, month: -1 }` — per-category target trend.

### `budgetTransactions`
The log. Append-mostly; edits and deletes allowed but rare.
```ts
{
  _id, userId,
  date: Date,              // when the money moved (full timestamp; time-of-day optional in UI)
  categoryId,              // ref to budgetCategories
  amount: number,          // positive integer minor units; sign derived from category.kind
  description?: string,    // optional, ≤500 chars, trimmed
  recurringTemplateId?,    // present if generated from a recurring template
  createdAt, updatedAt,
}
```
Indexes:
- `{ userId, date: -1 }` — primary list/month view.
- `{ userId, categoryId, date: -1 }` — per-category drill-down.

Sign is **derived** from `category.kind`, never stored on the transaction. This eliminates the "amount is -50 but category is income" inconsistency class entirely.

### `budgetRecurringTemplates`
User-defined templates for monthly repeats (rent, salary, subscriptions). v1 supports monthly cadence only.
```ts
{
  _id, userId,
  label: string,           // "Rent", "Spotify", "Monthly salary"
  categoryId,
  amount: number,          // positive integer minor units
  cadence: 'monthly',      // literal, v1 only
  dayOfMonth: number,      // 1–28 (avoids 29–31 month-length ambiguity)
  lastRunMonth?: string,   // "YYYY-MM" of most recent application
  active: boolean,
  createdAt, updatedAt,
}
```
Indexes:
- `{ userId, active }`.

### Why no pre-aggregated monthly summary collection?

Tempting to denormalize `{ userId, month, total, byGroup }` into a `budgetMonthlySummaries` doc for fast dashboard reads. Resisted for v1: at single-user manual-entry scale (dozens to low-hundreds of transactions per month), on-the-fly aggregation from `budgetTransactions` is fast. Pre-aggregation adds invalidation complexity for unclear benefit. Revisit only if reports get slow.

### Money representation
All amounts stored as **integer minor units** (paise for INR). Floats in financial code cause silent rounding bugs; integer minor units is the industry-standard fix. The UI converts to/from display strings at the edge. Sanity cap: `≤ 10^12` minor units per amount (~₹10 billion per transaction — well past plausible).

### Month identity
Months are stored as `YYYY-MM` strings (e.g., `"2026-05"`). Sidesteps the timezone foot-guns that come with using a `Date` to mean "May 2026." Transaction `date` remains a full `Date`; month is derived in queries via `date.toISOString().slice(0, 7)`. If aggregation gets slow, a denormalized `month` field on transactions is the obvious next step.

## API Surface

All endpoints under `/api/budget/*`, auth-required, scoped by `req.user.userId`.

| Method | Path | Purpose |
|---|---|---|
| GET    | `/api/budget/groups` | List groups for user. Seeds defaults if user has zero groups. |
| POST   | `/api/budget/groups` | Create a group. |
| PATCH  | `/api/budget/groups/:id` | Update group (name, color, archived). |
| DELETE | `/api/budget/groups/:id` | Archive (soft) a group. 409 if it has live (non-archived) categories. |
| PATCH  | `/api/budget/groups/reorder` | Bulk reorder by id list. |
| GET    | `/api/budget/categories?groupId=&kind=` | List categories, filtered. |
| POST   | `/api/budget/categories` | Create a category. |
| PATCH  | `/api/budget/categories/:id` | Update category. |
| DELETE | `/api/budget/categories/:id` | Archive (soft) — never hard delete; preserves transaction history. |
| PATCH  | `/api/budget/categories/reorder` | Bulk reorder within a group. |
| GET    | `/api/budget/transactions?month=YYYY-MM` | List transactions for a month. Defaults to current. |
| POST   | `/api/budget/transactions` | Create a transaction. |
| PATCH  | `/api/budget/transactions/:id` | Update a transaction. |
| DELETE | `/api/budget/transactions/:id` | Hard delete. |
| GET    | `/api/budget/targets?month=YYYY-MM` | List targets for a month. |
| PUT    | `/api/budget/targets` | Bulk upsert targets for a month: `{ month, items: [{categoryId, amount}] }`. |
| DELETE | `/api/budget/targets/:id` | Hard delete a single target. |
| GET    | `/api/budget/recurring` | List recurring templates. |
| POST   | `/api/budget/recurring` | Create a recurring template. |
| PATCH  | `/api/budget/recurring/:id` | Update a recurring template. |
| DELETE | `/api/budget/recurring/:id` | Hard delete. |
| POST   | `/api/budget/recurring/:id/apply` | Create a transaction for the current month; 409 if `lastRunMonth` already equals current. |
| GET    | `/api/budget/report?month=YYYY-MM` | Full retrospective: totals, per-group + per-category rollups, narrative, recurring-due list. |

### Currency update extension
`PATCH /api/auth/me` (or `PATCH /api/users/me`, matching the convention in apps/api at implementation time) is extended to accept a `currency: string` field validated against ISO 4217. If no such route exists yet in the codebase, a minimal one is added as part of the implementation; this is the only change touching the existing auth surface.

### Seeding
Not its own endpoint. On the first `GET /api/budget/groups` for a user with zero groups, the server seeds default groups + categories transactionally before returning them. Same one-shot pattern Pathforge uses for dev users on boot. Deleting all groups does **not** re-seed.

### Report endpoint shape
```ts
GET /api/budget/report?month=YYYY-MM → {
  month: string,
  currency: string,
  totals: { income: number, expense: number, net: number },
  targetTotals: { income: number, expense: number, net: number },
  groups: [{
    groupId, name, kind: 'income' | 'expense',
    actual: number, target: number, delta: number,
    categories: [{
      categoryId, name, actual: number, target: number, delta: number
    }]
  }],
  narrative: string,             // template-generated server-side, see below
  recurringDue: [{ templateId, label, amount, dayOfMonth }],
}
```

### Narrative generation (template, not LLM)
Computed server-side from the report data with a fixed template. Skeleton:

> In {Month}, you spent {expenseActual} against a planned {expenseTarget} — {over|under} by {delta} ({pct}%). Biggest overage: {category} ({actual} vs {target}). Biggest underspend: {category} ({actual} vs {target}).

Variants handle: no targets set for the month, zero transactions, income-only months, single-category months. A small set of templates, deterministic, testable.

## Frontend Shape

### Navigation entry
A new top-level **Budget** item in the navbar, alongside Roadmaps and Jobs. Same styling pattern.

### Routes
```
/budget                  → main page: input + two-column log for current month
/budget/plan             → targets management (set/edit per category per month)
/budget/report           → monthly retrospective
/budget/categories       → groups + categories management
/budget/recurring        → recurring templates management
/budget/settings         → currency selector (and a home for any future per-user settings)
```

A small tab strip lives at the top of each `/budget/*` route, linking between Log / Plan / Report / Categories / Recurring / Settings. The active tab is highlighted; the URL is the source of truth.

### Main page: `/budget`

Three-row layout for one month at a time, with a month selector at the top (defaults to current month).

```
┌──────────────────────────────────────────────────────────────┐
│  [< April]   May 2026   [June >]            [Plan | Report]  │
├──────────────────────────────────────────────────────────────┤
│   ┌────────────────────────────────────────────────────┐    │
│   │  Amount: [₹           ]   [ + Income ] [ − Expense ]│    │
│   │  Category: [ Groceries ▾ ]   Date: [May 22 ▾ 14:30] │    │
│   │  Description: [ optional what/why                  ]│    │
│   │                                  [Cancel] [Add]    │    │
│   └────────────────────────────────────────────────────┘    │
│                                                              │
│   Net this month: +₹15,200  (income ₹52,000 − exp ₹36,800)  │
│                                                              │
├──────────────────────────────────┬───────────────────────────┤
│  INCOMES — ₹52,000 (emerald)     │  EXPENSES — ₹36,800 (red) │
│                                  │                           │
│  ▼ Income                        │  ▼ Bills                  │
│    Salary             ₹50,000    │    Rent           ₹18,000 │
│    Freelance          ₹2,000     │    Electricity    ₹1,200  │
│                                  │  ▼ Household              │
│                                  │    Groceries      ₹6,400  │
│                                  │  ▼ Leisure                │
│                                  │    Dining         ₹3,200  │
└──────────────────────────────────┴───────────────────────────┘
```

**Input row behavior**
- Amount field is the focal point: large, autofocused on page load.
- `+ Income` / `− Expense` toggles drive (a) the sign of the entry and (b) the category dropdown contents — income categories only when Income is active; expense categories only when Expense is active.
- Date defaults to today; time defaults to "now". Both editable. Backdating to a prior month is allowed; the transaction lands in that month's view and a toast offers to switch (`"Added to April — switch?"`).
- Description is optional, single line, ≤500 chars.
- Enter from the amount field with a category already selected submits.
- After submit: row clears, focus returns to amount, the new transaction animates into its column.

**Two-column log**
- **Left (emerald) — Incomes for selected month.** Grouped first by category group, then by category. Per-category subtotal shown; per-transaction rows expandable to show description and time.
- **Right (red) — Expenses for selected month.** Same structure.
- Groups collapse/expand. Within a category, transactions are listed newest-first; groups of 5+ show "View all" affordance to expand inline.
- Each transaction row has a hover-revealed edit/delete affordance opening a small inline edit panel reusing the input row's component.

**At-a-glance band** above the columns: `Income / Expense / Net` totals for the selected month. Net colored emerald if positive, red if negative.

**Empty state.** First-time user lands on `/budget` and sees an inviting input row, plus a primer: *"Add your first transaction. Categories and groups are pre-seeded — you can customize them in Categories whenever you like."* Plus a small "Need recurring rent or salary set up first?" link to `/budget/recurring`.

### `/budget/plan` — targets management

Tab strip at top, then a grouped list of categories with a target-amount input next to each. Month selector defaults to current. Groups as section headers; each category as a row `[Category name] [target input ₹___]`.

**Target carry-forward.** When the user opens Plan for a month that has no targets yet, the previous month's targets are pre-filled into the inputs as **draft state** with a banner: *"These are last month's numbers — confirm or adjust, then Save."* Nothing persists until the user clicks Save. This keeps the soft-target ethos: every month is an intentional re-aim, not a passive copy. If there is no previous month with targets either (first-ever use), all inputs start empty and the banner reads: *"Set your first monthly targets — they're soft anchors, not hard limits."*

### `/budget/report` — monthly retrospective

The differentiator. Reuses the two-column layout from `/budget` but with **target overlays**: each category row shows `actual / target` as both numbers and a thin progress bar. Over-target categories surface a small red marker; under-target a small emerald one. Group-level rollups show `total actual / total target` for each group.

At the top, the month's headline narrative (from the report endpoint), e.g.:

> *In May, you spent ₹36,800 against a planned ₹40,000 — under by ₹3,200 (8%). Biggest overage: Dining (₹3,200 vs ₹2,000). Biggest underspend: Groceries (₹6,400 vs ₹8,000).*

Below the narrative, a compact group-rollup band, then the per-category details.

### `/budget/categories` — group + category management

Two-pane layout: groups on the left (orderable list with drag-and-drop), categories on the right (filtered to the selected group, orderable within). Add/edit/archive flows for both. Color picker on groups; categories inherit their group's color unless explicitly overridden. Archived items are hidden by default with a toggle to show them.

### `/budget/recurring` — recurring template management

Plain list of templates with: label, amount, category, day-of-month, active toggle. **"Apply now"** button on each due-but-not-yet-applied template for the current month (i.e., `lastRunMonth !== currentMonth && active`). Empty state walks through creating the user's first template (e.g., Rent or Salary).

### `/budget/settings` — currency

A single currency selector backed by the `currency` field on the user document. Lives here (rather than `/profile`) to keep the existing read-only profile page untouched and to keep Budget self-contained. If a richer profile-edit surface is added later, this control can migrate. ISO 4217 codes; common ones (INR, USD, EUR, GBP, AUD, CAD, SGD, JPY) surfaced at the top of the picker.

### Hooks (TanStack Query)

```ts
useBudgetGroups()                      // ['budget', 'groups']
useBudgetCategories({ groupId?, kind? }) // ['budget', 'categories', filter]
useBudgetTransactions(month)           // ['budget', 'transactions', month]
useBudgetTargets(month)                // ['budget', 'targets', month]
useBudgetReport(month)                 // ['budget', 'report', month]
useBudgetRecurring()                   // ['budget', 'recurring']
useBudgetSummary(month)                // Wrapper around report for the dashboard widget
```

Mutations invalidate related keys. Adding a transaction invalidates `['budget', 'transactions', month]` and `['budget', 'report', month]`. Saving targets invalidates `['budget', 'targets', month]` and `['budget', 'report', month]`. Applying a recurring template invalidates `['budget', 'transactions', month]`, `['budget', 'report', month]`, and `['budget', 'recurring']`.

### Aesthetic continuity
- Inter throughout (per the 2026-05-18 Stripe/Apple redesign of Roadmaps).
- Emerald = income, red = expense, sky as the existing app accent.
- Cards, headers, form controls reuse the existing shadcn/ui set.
- Group/category colors are user-chosen (modest swatch) so the two-column view has visual rhythm without becoming a rainbow.

## Dashboard Widget

A new `BudgetWidget` joins the existing secondary-widget grid alongside `RoadmapsWidget` and `JobsWidget`, following the pattern shipped on 2026-05-22.

**Shape**
```
┌─────────────────────────────────────┐
│  Budget — May                    →  │
│                                     │
│  Net so far    +₹15,200             │
│  Spent         ₹36,800 of ₹40,000   │
│  ▓▓▓▓▓▓▓▓▓░░  92% of plan           │
│                                     │
│  Top categories                     │
│  Rent          ₹18,000 / 18,000  ✓  │
│  Groceries     ₹6,400 / 8,000    ✓  │
│  Dining        ₹3,200 / 2,000    ⚠  │
│                                     │
│  + Quick add                        │
└─────────────────────────────────────┘
```

- Header click-throughs to `/budget`.
- Top section: month-to-date headline numbers (Net, Spent vs plan, progress bar).
- Top-categories list: three categories with the largest absolute spend this month, each with target-comparison readout. Over-target gets a small warning marker.
- "+ Quick add" opens a compact modal containing the same input-row component used on `/budget`, so keystroke patterns carry over.
- **States**: loading (skeleton matching the existing widget skeleton style); empty (zero transactions this month → "Add your first transaction" CTA linking to `/budget`); no-targets-set (totals only, omits the progress bar and the "of plan" suffix).
- Data: `useBudgetSummary(currentMonth)` which calls `GET /api/budget/report?month=` and returns everything the widget needs in one round-trip. No new server endpoint.

## Validation, Edge Cases, Testing

### Shared Zod validation (`packages/shared/src/budget.ts`)
- `amount`: positive integer, `≤ 10^12` minor units.
- `month`: regex `/^\d{4}-(0[1-9]|1[0-2])$/`.
- `description`: optional string, ≤500 chars, trimmed.
- `dayOfMonth`: integer 1–28.
- `cadence`: literal `'monthly'`.
- `kind`: union `'income' | 'expense'`.
- `color`: 6-char hex with `#` prefix (`/^#[0-9a-fA-F]{6}$/`).
- All `*Id` references validated at the route layer (must reference a doc owned by `req.user.userId`).
- `currency`: ISO 4217, validated against a fixed list.

### Edge cases
- **Deleting a category with transactions** → archive (soft) only, never hard delete. Archived categories appear in historical month reports (grey) but are hidden from the input dropdown.
- **Deleting a group that still has live categories** → 409 with `{ error: 'group_has_active_categories' }` and a hint to move/archive children first.
- **Editing a transaction's category to a different `kind`** (e.g., expense → income) → allowed; the report and totals recompute. No special migration.
- **Applying a recurring template twice in the same month** → 409 with `{ error: 'already_applied', lastRunMonth }`.
- **Backdating to a month with no targets set** → report renders actuals-only (no target overlay, no progress bars). Narrative adapts: *"In March, you spent ₹X — no plan was set for this month."*
- **Future-dating a transaction** → allowed (lets users pre-log known upcoming spends). Future-dated transactions appear in their month's column normally; no special filtering or toggle in v1. The month report includes them in totals.
- **Currency change** → does not retroactively convert past amounts. Symbol updates everywhere; numbers stay the same integer minor units.
- **Two transactions on the same day in the same category** → fully supported; they're separate rows, neither is deduplicated. Recurring templates use `lastRunMonth` rather than transaction equality to detect re-application.
- **Targets for archived categories** → preserved; they show in historical reports but cannot be edited going forward.

### Testing
- **API**: smoke test per resource (create → fetch → update → archive → list) plus one focused test per edge case above. Follows the existing pattern in `apps/api`.
- **Shared**: Zod round-trip tests on the trickier schemas (month regex bounds, amount cap, color regex, currency list).
- **Web**: component tests for the input-row keyboard flow (Enter submits when valid; +Income/−Expense toggle swaps the category list; amount-only without category is rejected). This is the high-friction surface and worth covering. No end-to-end browser tests in v1, matching project convention.

## Phasing

**v1 (this spec)**: everything above. Single-user, single-currency, manual-entry, standalone.

**Phase 2 candidates** (not in scope here, but the data model accommodates them without migration):
- CSV import (statement parsers, dedup heuristics).
- Cross-feature integration: link a category to a roadmap; link a recurring income template to a job application's offer; "career runway" derived view.
- Multi-account modeling, transfers, net-worth tracking, liabilities.
- Bank integration via Plaid/Teller (only if traction and a revenue story exist — significant ongoing cost and security burden).
- LLM-generated narrative or insights (the `narrative` field is already a string on the report endpoint; swap the template generator for an LLM call when ready).
- Tags-on-top-of-categories, transaction splits, attachments.
