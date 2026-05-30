# Budget Monthly Export — Design Spec

**Status:** Draft
**Date:** 2026-05-30
**Owner:** @kanishkdebnath
**Scope:** Frontend-only feature on `apps/web`. No API or shared-package changes.

## Problem

The Budget feature surfaces a monthly Report page (`/budget/report`) with totals, group/category breakdowns, a narrative, and a list of recurring templates due in the selected month. Users have no way to take that view off the app: no archive, no shareable artifact, no offline copy. We want a one-click monthly export that produces:

1. A **PDF** that mirrors the on-screen Report — narrative + group tables — suitable for archiving or sharing.
2. An **Excel** workbook of the underlying raw data for the same month — transactions, per-category targets, and recurring templates — suitable for re-pivoting or analysis later.

## Non-goals

- Multi-month exports (a single month is the unit).
- Custom date ranges that don't align to a calendar month.
- Server-side rendering, scheduled emailed exports, or any cron.
- Editable PDF forms or interactive Excel macros.
- Changes to the existing `BudgetReport`, `BudgetTransaction`, `BudgetTarget`, or `BudgetRecurring` schemas.
- Localization of the PDF beyond the existing currency formatting (English-only labels, `en-US` month name).

## UI surface

On `/budget/report`, add an **Export** button to the right of `BudgetMonthSelector`. Clicking it opens a small popover/menu with three items:

- **PDF (report)**
- **Excel (.xlsx logs)**
- **Both**

Behavior:

1. Selecting an item closes the menu and shows a "Preparing…" state on the button.
2. The relevant generator(s) run client-side; each produced file is saved via a transient `<a download>` element.
3. File names:
   - `pathforge-budget-{month}-report.pdf` (e.g. `pathforge-budget-2026-05-report.pdf`)
   - `pathforge-budget-{month}-logs.xlsx`
4. On success, the button briefly shows "Done" for ~1.5s then returns to "Export".
5. On failure, an inline toast: *"Couldn't generate export. Try again."*
6. The button (and all menu items) are disabled until every required query has resolved successfully.

## Data model — the export input

A normalized object the two builders consume. Built by `BudgetReportPage` from the existing TanStack Query hooks; never re-fetched by the builders.

```ts
type BudgetExportInput = {
  month: string;          // "YYYY-MM"
  monthLabel: string;     // e.g. "May 2026" via Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' })
  currency: CurrencyCode; // ISO code, e.g. "INR"

  // From useBudgetReport(month)
  report: BudgetReport;   // includes totals, targetTotals, groups[], narrative, recurringDue[]

  // From useBudgetTransactions(month), with group/category names pre-resolved
  transactions: Array<{
    date: string;         // "YYYY-MM-DD" — derived from BudgetTransaction.date (Date) via toISOString().slice(0,10)
    groupName: string;
    categoryName: string;
    kind: 'income' | 'expense';
    amount: number;       // minor units
    description: string;  // "" if BudgetTransaction.description is undefined
  }>;

  // From useBudgetTargets(month) + useBudgetGroups() + useBudgetCategories()
  targets: Array<{
    groupName: string;
    categoryName: string;
    kind: 'income' | 'expense';
    target: number;       // minor units
    actual: number;       // minor units (joined from report.groups[].categories[])
    delta: number;        // minor units (joined from report.groups[].categories[])
  }>;

  // From report.recurringDue + useBudgetTransactions to compute "applied?"
  recurring: Array<{
    label: string;
    dayOfMonth: number;
    amount: number;       // minor units
    applied: boolean;     // true if any transaction this month carries this template's _id in BudgetTransaction.recurringTemplateId
  }>;
};
```

`amount` is always in **minor units** (cents/paise/yen) — the same representation the API and `budget-formatting.ts` use. Conversion to display values happens inside the builders.

## Excel structure

A single `.xlsx` with three sheets in this order. All amount columns use Excel currency formatting; rounding rules match `apps/web/src/lib/budget-formatting.ts` (JPY whole units, other ISO codes to 2 decimals).

Workbook metadata: `title = "Pathforge Budget — {month}"`, `creator = "Pathforge"`.

Each sheet uses row 1 for a caption (`"Currency: INR"`), row 2 for headers (bold), row 3+ for data. Header row is frozen.

### Sheet 1 — "Transactions"

One row per log entry, sorted by `date` ascending, then by insertion order from the API.

| Column   | Source                                | Notes                                                  |
| -------- | ------------------------------------- | ------------------------------------------------------ |
| Date        | `transaction.date`                | Excel date type, displayed `YYYY-MM-DD`                |
| Group       | resolved from `category.groupId`  | text                                                   |
| Category    | `category.name`                   | text                                                   |
| Kind        | `category.kind`                   | "Income" / "Expense" (Title Case)                      |
| Amount      | `transaction.amount`              | Excel number, currency-formatted using header currency |
| Description | `transaction.description ?? ""`   | text (`BudgetTransaction.description` is optional in the schema) |

Column widths: Date 12, Group 20, Category 24, Kind 10, Amount 14, Description 40.

Final summary block (two rows below last data row, bold):
- `Income total`  — `SUMIF(KindCol, "Income", AmountCol)`
- `Expense total` — `SUMIF(KindCol, "Expense", AmountCol)`
- `Net`           — `Income total − Expense total`

Using formulas (not pre-computed values) means edits in the sheet flow to the totals.

**Empty-month behavior:** Header row still rendered. Row 3 contains the caption *"No transactions in this month."* in italic, merged across columns. The summary block is omitted.

### Sheet 2 — "Targets"

One row per category that has either a non-zero target *or* a non-zero actual in this month, sorted by group then category.

| Group | Category | Kind | Target | Actual | Delta |

Numeric columns currency-formatted. Two summary rows at the bottom (bold): one for Income totals, one for Expense totals — each summing Target, Actual, Delta across their respective rows. Categories with both target=0 and actual=0 are omitted to keep the sheet useful.

### Sheet 3 — "Recurring"

One row per template in `report.recurringDue`, sorted by `dayOfMonth` ascending.

| Label | Day of Month | Amount | Applied? |

`Applied?` shows "Yes" if any transaction in this month has `BudgetTransaction.recurringTemplateId === template._id`; otherwise "No". The link is resolved by the page-level join logic before the builders are called; builders just consume the boolean.

## PDF structure

A4 portrait, single document, generated with `jspdf` + `jspdf-autotable`. `autoTable` manages page breaks; we don't manually paginate.

### Page header (every page)

- Left: **"Pathforge Budget"** (bold)
- Right: **"{Month name} {Year}"** (e.g. "May 2026")
- Thin horizontal rule below

### Page 1, top — Summary band

Three-column block, no table chrome:

- **Income** — total actual / total target
- **Expense** — total actual / total target
- **Net** — actual / target

Target values are rendered in muted gray. Actual net is green if `actualNet ≥ targetNet`, else red.

### Page 1, below summary — Narrative

The `report.narrative` string rendered as wrapped paragraph text in a light gray background block, 12pt body font, ~1.3 line-height. Uses `doc.splitTextToSize` so it page-breaks cleanly before the first group table. Skipped entirely if narrative is empty.

### Group/Category tables — one per group

Iterated in the order returned by `report.groups`. For each group:

1. Heading row: `{Group name}` bold, with a `{Kind}` chip (Income/Expense) on the right.
2. `autoTable` with columns: **Category | Target | Actual | Delta**.
3. Final row of each table is the group subtotal (bold).
4. Negative delta values in red; zero or positive in default text.
5. Delta column shows signed values with a leading `+` / `−` glyph.

Groups where every category has target=0 and actual=0 are skipped.

`columnStyles` widens Category to absorb extra width; Target/Actual/Delta are fixed-width numeric.

### Recurring-due section (last)

Heading: **"Recurring this month"**. Skipped entirely if `report.recurringDue` is empty.

Columns: **Label | Day | Amount**. No subtotal.

### Footer (every page)

- Left, muted: `"Generated {YYYY-MM-DD HH:mm}"` in user's local time
- Right: `"Page {n} of {total}"`

## Generation flow

```
[user clicks PDF/Excel/Both]
        |
        v
[BudgetExportMenu]
   sets state = "preparing"
   calls exportBudgetPdf(input) | exportBudgetXlsx(input) | exportBudgetBoth(input)
        |
        v
[lib/budget-export/index.ts]
   dynamic-imports the relevant builder module(s)
   awaits buildPdf(input) and/or buildXlsx(input)
   passes the resulting Blob to triggerDownload(blob, filename)
        |
        v
[BudgetExportMenu]
   on success → state = "done" (~1.5s) → state = "idle"
   on failure → toast, state = "idle"
```

For **Both**, the two builders run concurrently with `Promise.all`. Two `<a download>` clicks fire back-to-back within the same click handler; browsers handle this correctly.

## Code organization

New files, all under `apps/web/src`:

```
components/budget/
  BudgetExportMenu.tsx               # button + popover, lives next to BudgetMonthSelector

lib/budget-export/
  index.ts                            # public surface: exportBudgetPdf / Xlsx / Both — dynamic imports
  types.ts                            # BudgetExportInput
  build-xlsx.ts                       # pure: (input) -> ArrayBuffer (uses exceljs)
  build-pdf.ts                        # pure: (input) -> Blob (uses jspdf + jspdf-autotable)
  download.ts                         # triggerDownload(blob, filename) via transient <a>
  format.ts                           # currency helpers shared with budget-formatting.ts
  __tests__/
    build-xlsx.test.ts
    build-pdf.test.ts
    BudgetExportMenu.test.tsx
```

`BudgetReportPage` is the only place that touches TanStack Query for export. It assembles a `BudgetExportInput` and passes it to `BudgetExportMenu`. The builders are pure (input → file Blob/ArrayBuffer) and have no React or query dependencies — that makes them straightforward to unit-test.

## Error handling

| Failure mode                              | Behavior                                                                                                                          |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Any required query failed                 | Menu items disabled; tooltip explains *"Report data not loaded"*                                                                  |
| Dynamic import fails (chunk-load, offline) | Caught at `index.ts` level → menu shows toast *"Couldn't generate export. Try again."*; error logged with tag `[budget-export]` |
| Builder throws (corrupt data, etc.)       | Same toast + log path                                                                                                             |
| `<a download>` blocked by browser         | Catches the underlying DOM error → same toast                                                                                     |

No retry button; user re-clicks the menu item.

## Edge cases

- **Empty month** (no transactions): Excel renders with the "No transactions in this month." caption. PDF still renders summary band (zeros) and skips all group tables; narrative is preserved if non-empty.
- **Currency rounding:** All builders divide minor units using the same helper as `budget-formatting.ts`; we extract that helper into a shared util so the rules cannot drift.
- **Long category names** in PDF: `autoTable` wraps cells; Category column gets the most width, numeric columns are fixed.
- **Long narrative:** `splitTextToSize` handles wrapping; `autoTable` flows tables onto the next page if the narrative pushes them.
- **Month label:** Always `en-US`, via `Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' })`.

## Dependencies

Added to `apps/web/package.json`:

- `exceljs` (~250 KB minified)
- `jspdf` (~80 KB)
- `jspdf-autotable` (~70 KB)

All three loaded exclusively via dynamic `import()`. Verified after the feature lands by checking the main bundle does not contain `exceljs` or `jspdf` modules (e.g. via `vite-bundle-visualizer` or by inspecting `dist/`).

## Testing

Vitest harness was added in the budget-calculator work (commit `ce8c687`); we use the same setup.

### Unit tests

`build-xlsx.test.ts`
- Builds a workbook from a fixture with a mix of income/expense transactions across two groups.
- Reads it back with `exceljs` and asserts:
  - Sheet names and order: `["Transactions", "Targets", "Recurring"]`
  - Transactions row count matches fixture
  - Header row text in row 2
  - Currency format string present on Amount cells
  - Summary block formulas (`SUMIF(...)`) exist and evaluate correctly via exceljs's evaluator (or manually computed)
- Empty-fixture case: asserts the "No transactions in this month." caption.

`build-pdf.test.ts`
- Builds a PDF, asserts:
  - Non-empty Blob with `application/pdf` MIME
  - `jspdf.internal.pages.length >= 1`
  - Text extraction (via `pdf.output('arraybuffer')` + regex on the content stream) finds the month label, one known group name, and the word "Recurring" when recurringDue is non-empty
- Smoke test only; no pixel-layout assertions.

### Component test

`BudgetExportMenu.test.tsx` (React Testing Library)
- Renders the menu with `ready: false` → all items disabled.
- Renders with `ready: true` → clicking each item calls the corresponding mocked exporter exactly once with the right input.
- "Both" path calls both exporters.

### Manual verification

After implementation:
- Open `/budget/report` with the existing dev user data.
- Click Export → PDF → file downloads and visually matches the on-screen report.
- Click Export → Excel → file opens in Numbers/Excel and the three tabs match the spec.
- Click Export → Both → two files download.
- Test an empty month (use the month selector to pick a future month with no data).
- Bundle check: run `npm run build` in `apps/web` and confirm the main chunk does not contain `exceljs` or `jspdf` (the lazy chunk should).

## Open questions (to resolve during planning)

1. **Currency caption per sheet:** Whether to show "Currency: INR" on each sheet (current spec) or once at the workbook-properties level only. Current call: per-sheet, because consumers often paste a single tab elsewhere.

## Out-of-scope follow-ups (worth filing as issues)

- Multi-month / YTD export
- Scheduled email export
- CSV export option
- Localizing the PDF labels
- Server-side generation for users on low-end devices

## Changelog

- 2026-05-30: Initial draft.
- 2026-05-30: Corrected transaction field name (`description`, not `note`). Resolved recurring "Applied?" join by using `BudgetTransaction.recurringTemplateId` (already exists in the schema).
