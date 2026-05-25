# Budget — Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the frontend half of the Budget feature against the already-merged backend: data-fetching hooks, six routes under `/budget/*`, the hero input row + two-column log on the main page, plan/report/categories/recurring/settings sub-pages, a dashboard widget, and a Navbar entry — all wired against the existing `/api/budget/*` endpoints.

**Architecture:** Mirrors the existing per-feature frontend shape (`Roadmaps`/`Jobs`/`Journal`). One `useBudget.ts` hook module owns all server state behind TanStack Query keys; six page components compose feature-scoped components from `apps/web/src/components/budget/`; a single `BudgetTabStrip` lives at the top of every `/budget/*` page for sub-navigation. Dashboard widget reads from `useBudgetReport`. Styling reuses Inter + sky/emerald/red + the existing shadcn/ui set.

**Tech Stack:** React 18, Vite, TypeScript, TanStack Query, React Hook Form + Zod, axios (`withCredentials`), shadcn/ui, @dnd-kit for reorder, Sonner for toasts, Tailwind. Inferred types from `@pathforge/shared` (already exporting `BudgetCategoryGroup`, `BudgetCategory`, `BudgetTarget`, `BudgetTransaction`, `BudgetRecurringTemplate`, `BudgetReport`, plus request/response types).

**Spec:** [docs/superpowers/specs/2026-05-22-budget-feature-design.md](../specs/2026-05-22-budget-feature-design.md)
**Backend plan (already shipped):** [docs/superpowers/plans/2026-05-22-budget-backend.md](2026-05-22-budget-backend.md)

---

## File Map

**Create:**
- `apps/web/src/hooks/useBudget.ts` — All TanStack Query hooks and mutations for the Budget domain.
- `apps/web/src/lib/budget-formatting.ts` — Money (minor units → display string) and month (`YYYY-MM` ↔ "Month YYYY") formatters.
- `apps/web/src/lib/budget-month.ts` — Client-side `toIsoMonth`, `addMonths`, current-month default.
- `apps/web/src/components/budget/BudgetTabStrip.tsx` — Sub-navigation rendered at top of every `/budget/*` page.
- `apps/web/src/components/budget/BudgetMonthSelector.tsx` — `[< prev] Month YYYY [next >]` selector (shared by Log, Plan, Report).
- `apps/web/src/components/budget/BudgetInputRow.tsx` — Hero input: amount + Income/Expense toggle + category + date + description + Add.
- `apps/web/src/components/budget/BudgetNetBand.tsx` — At-a-glance Income / Expense / Net band.
- `apps/web/src/components/budget/BudgetLogColumn.tsx` — One column (income or expense) with group → category → transaction nesting.
- `apps/web/src/components/budget/BudgetTransactionRow.tsx` — One transaction line with hover edit/delete.
- `apps/web/src/components/budget/BudgetEditTransactionDialog.tsx` — Edit dialog reusing the input-row component.
- `apps/web/src/components/budget/BudgetGroupDialog.tsx` — Create/edit group (name + color).
- `apps/web/src/components/budget/BudgetCategoryDialog.tsx` — Create/edit category (group + name + kind + optional color).
- `apps/web/src/components/budget/BudgetGroupList.tsx` — Categories page left pane (orderable list of groups + create button).
- `apps/web/src/components/budget/BudgetCategoryList.tsx` — Categories page right pane (orderable list of categories within a group + create button).
- `apps/web/src/components/budget/BudgetDeleteGroupConfirm.tsx` — Confirm dialog for archive-group.
- `apps/web/src/components/budget/BudgetDeleteCategoryConfirm.tsx` — Confirm dialog for archive-category.
- `apps/web/src/components/budget/BudgetTargetsForm.tsx` — Plan page form: grouped list of categories with target-amount inputs + carry-forward banner.
- `apps/web/src/components/budget/BudgetReportNarrative.tsx` — Narrative banner at top of report.
- `apps/web/src/components/budget/BudgetReportGroups.tsx` — Group rollups + per-category target-vs-actual bars.
- `apps/web/src/components/budget/BudgetRecurringList.tsx` — List of templates with Apply / Edit / Delete affordances.
- `apps/web/src/components/budget/BudgetRecurringFormDialog.tsx` — Create/edit recurring template.
- `apps/web/src/components/budget/BudgetCurrencySelector.tsx` — Currency picker on settings page.
- `apps/web/src/components/dashboard/BudgetWidget.tsx` — Dashboard widget.
- `apps/web/src/pages/BudgetPage.tsx` — `/budget` main page.
- `apps/web/src/pages/BudgetPlanPage.tsx` — `/budget/plan`.
- `apps/web/src/pages/BudgetReportPage.tsx` — `/budget/report`.
- `apps/web/src/pages/BudgetCategoriesPage.tsx` — `/budget/categories`.
- `apps/web/src/pages/BudgetRecurringPage.tsx` — `/budget/recurring`.
- `apps/web/src/pages/BudgetSettingsPage.tsx` — `/budget/settings`.

**Modify:**
- `apps/web/src/App.tsx` — Register six `/budget/*` routes.
- `apps/web/src/components/Navbar.tsx` — Add `Budget` link.
- `apps/web/src/hooks/useAuth.ts` — Add `useUpdateMe` mutation for updating `currency` (and any other PATCH /me fields).
- `apps/web/src/pages/Dashboard.tsx` — Slot the `BudgetWidget` into the secondary widget grid.

**Out of scope (deferred):**
- Tour markers (`data-tour="..."`) — the onboarding tour does not yet cover Budget. Spec doesn't require it for v1.
- Cross-feature linking (category ↔ roadmap, transaction ↔ milestone) — spec defers to Phase 2.
- Mobile-specific responsive optimizations beyond what Tailwind defaults give us.
- CSV import / Plaid integrations — backend doesn't support either.

---

## Task Conventions

- Steps marked `[Read first]` are orientation reads. Skip if you've already absorbed the file.
- `Run` commands are from the repo root (`/Users/kanishkdebnath/Developer/pathforge`).
- Verification commands: `npx tsc --noEmit -p apps/web/tsconfig.json` for web typecheck, `npx tsc --noEmit -p apps/api/tsconfig.json` for the API (since hooks import shared types). The `@pathforge/shared` package has no build script — workspaces consume the TS source directly. Tests: `npm test --workspace=apps/api -- --run` if you touch anything API-adjacent (the API tests must still pass at every commit on this branch).
- Commit at the end of each task with the project's existing tone: `feat(web): …`, `chore(web): …`. Include the Co-Authored-By trailer in every commit.
- The frontend uses path aliases via Vite: `@/components/...`, `@/hooks/...`, `@/lib/...`, `@/pages/...`. Always use these aliases.
- Money is integer minor units throughout the API. Format at the display edge using `formatMoney` from `apps/web/src/lib/budget-formatting.ts` (introduced in Task 1).
- Sub-routes share the same `BudgetTabStrip`. Don't repeat the strip code per page — import it.

---

## Task 1 — Foundation: hooks + lib utilities

**Files:**
- Create: `apps/web/src/lib/budget-month.ts`
- Create: `apps/web/src/lib/budget-formatting.ts`
- Create: `apps/web/src/hooks/useBudget.ts`

- [ ] **Step 1: [Read first] Orient on conventions**

Read `apps/web/src/hooks/useJobs.ts` (query-key prefixes, optimistic mutation pattern, toast error helper structure) and `apps/web/src/lib/api.ts` (axios instance — `baseURL: '/api'`, `withCredentials: true`). Also re-read the shared types — they live in `packages/shared/src/budget.ts` and are re-exported by `packages/shared/src/index.ts` so a `from '@pathforge/shared'` import works.

- [ ] **Step 2: Create `apps/web/src/lib/budget-month.ts`**

```typescript
/** Returns `YYYY-MM` for the given local Date (or current date if omitted). */
export function toIsoMonth(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/** Returns the current local month as `YYYY-MM`. */
export function currentIsoMonth(): string {
  return toIsoMonth(new Date());
}

/** Adds `delta` calendar months to a `YYYY-MM` string. Returns `YYYY-MM`. */
export function addMonths(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const d = new Date(y, m - 1 + delta, 1);
  return toIsoMonth(d);
}

/** Pretty label for display: "May 2026". */
export function formatMonthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const date = new Date(y, m - 1, 1);
  return date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
}
```

- [ ] **Step 3: Create `apps/web/src/lib/budget-formatting.ts`**

```typescript
/**
 * Currency-symbol lookup for the codes the picker promotes (matches the
 * server-side CURRENCY_SYMBOL in apps/api/src/lib/budget-helpers.ts).
 */
const CURRENCY_SYMBOL: Record<string, string> = {
  INR: '₹',
  USD: '$',
  EUR: '€',
  GBP: '£',
  AUD: 'A$',
  CAD: 'C$',
  SGD: 'S$',
  JPY: '¥',
};

/** Returns the localized digit grouping for a currency. INR uses lakhs/crores; others use western grouping. */
function localeFor(currency: string): string {
  return currency === 'INR' ? 'en-IN' : 'en-US';
}

/**
 * Formats an integer in minor units to a display string with currency symbol.
 * e.g. (50000, 'INR') → "₹500"   (5000_00, 'INR') → "₹5,00,000"
 *      (5000, 'USD')  → "$50"     (100000_00, 'USD') → "$100,000"
 *
 * The minor → major conversion divides by 100. Two-decimal currencies only
 * for v1 (none of the COMMON_CURRENCIES in the picker has a different scale).
 */
export function formatMoney(minor: number, currency: string): string {
  const major = Math.round(minor / 100);
  const symbol = CURRENCY_SYMBOL[currency] ?? `${currency} `;
  return `${symbol}${major.toLocaleString(localeFor(currency))}`;
}

/**
 * Parses a user-typed major-unit string (e.g. "1,200" or "500.50") into
 * integer minor units. Returns `null` if the input is not a valid amount.
 * Accepts decimal points only — commas are stripped before parsing.
 */
export function parseMajorToMinor(input: string): number | null {
  const stripped = input.trim().replace(/,/g, '');
  if (stripped === '') return null;
  const major = Number(stripped);
  if (!Number.isFinite(major) || major < 0) return null;
  return Math.round(major * 100);
}

/** Format an integer minor amount as a user-editable major-unit string (no symbol). e.g. 50_000 → "500" */
export function formatMinorForInput(minor: number): string {
  const major = minor / 100;
  // Show two decimals only if needed (cents present).
  return Number.isInteger(major) ? String(major) : major.toFixed(2);
}
```

- [ ] **Step 4: Create `apps/web/src/hooks/useBudget.ts`**

```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { toast } from 'sonner';
import type {
  BudgetCategoryGroup,
  BudgetCategory,
  BudgetTarget,
  BudgetTransaction,
  BudgetRecurringTemplate,
  BudgetReport,
  CategoryKind,
} from '@pathforge/shared';
import { api } from '../lib/api';

// ---- Error helpers (mirror useJobs.ts) ----

interface ServerErrorBody {
  error?: string;
  message?: string;
  details?: Array<{ path: string; message: string }>;
  lastRunMonth?: string;
}

function toastError(fallback: string, err: unknown): void {
  toast.error(extractMessage(err) ?? fallback, {
    description: extractDescription(err),
  });
}

function extractMessage(err: unknown): string | undefined {
  if (err instanceof AxiosError) {
    const status = err.response?.status;
    if (status === 401) return 'Session expired — sign in again';
    const data = err.response?.data as ServerErrorBody | undefined;
    if (data?.details && data.details.length > 0) {
      const first = data.details[0]!;
      return first.path ? `${first.path}: ${first.message}` : first.message;
    }
    if (typeof data?.message === 'string' && data.message !== data.error) {
      return data.message;
    }
    if (typeof data?.error === 'string') return data.error;
    if (!err.response) return `Network error: ${err.message}`;
  }
  return undefined;
}

function extractDescription(err: unknown): string | undefined {
  if (!(err instanceof AxiosError)) return undefined;
  const data = err.response?.data as ServerErrorBody | undefined;
  if (!data?.details || data.details.length <= 1) return undefined;
  return data.details
    .slice(1)
    .map((d) => (d.path ? `${d.path}: ${d.message}` : d.message))
    .join(' · ');
}

// ---- Query keys ----

const GROUPS_KEY = ['budget', 'groups'] as const;
const CATEGORIES_KEY = ['budget', 'categories'] as const;
const TRANSACTIONS_KEY = (month: string) =>
  ['budget', 'transactions', month] as const;
const TRANSACTIONS_PREFIX = ['budget', 'transactions'] as const;
const TARGETS_KEY = (month: string) => ['budget', 'targets', month] as const;
const TARGETS_PREFIX = ['budget', 'targets'] as const;
const RECURRING_KEY = ['budget', 'recurring'] as const;
const REPORT_KEY = (month: string) => ['budget', 'report', month] as const;
const REPORT_PREFIX = ['budget', 'report'] as const;

// ---- Groups ----

export function useBudgetGroups() {
  return useQuery({
    queryKey: GROUPS_KEY,
    queryFn: async (): Promise<BudgetCategoryGroup[]> => {
      const res = await api.get('/budget/groups');
      return res.data;
    },
  });
}

type CreateGroupBody = { name: string; color: string };
type UpdateGroupBody = { name?: string; color?: string; archived?: boolean };

export function useCreateBudgetGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateGroupBody): Promise<BudgetCategoryGroup> => {
      const res = await api.post('/budget/groups', body);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: GROUPS_KEY });
      qc.invalidateQueries({ queryKey: REPORT_PREFIX });
    },
    onError: (err) => toastError('Could not create group', err),
  });
}

export function useUpdateBudgetGroup(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: UpdateGroupBody): Promise<BudgetCategoryGroup> => {
      const res = await api.patch(`/budget/groups/${id}`, body);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: GROUPS_KEY });
      qc.invalidateQueries({ queryKey: REPORT_PREFIX });
    },
    onError: (err) => toastError('Could not update group', err),
  });
}

export function useArchiveBudgetGroup(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<BudgetCategoryGroup> => {
      const res = await api.delete(`/budget/groups/${id}`);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: GROUPS_KEY });
      qc.invalidateQueries({ queryKey: CATEGORIES_KEY });
      qc.invalidateQueries({ queryKey: REPORT_PREFIX });
    },
    onError: (err) => toastError('Could not archive group', err),
  });
}

export function useReorderBudgetGroups() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]): Promise<BudgetCategoryGroup[]> => {
      const res = await api.patch('/budget/groups/reorder', { ids });
      return res.data;
    },
    onSuccess: (fresh) => {
      qc.setQueryData(GROUPS_KEY, fresh);
      qc.invalidateQueries({ queryKey: REPORT_PREFIX });
    },
    onError: (err) => toastError('Could not reorder groups', err),
  });
}

// ---- Categories ----

export function useBudgetCategories(filter?: { groupId?: string; kind?: CategoryKind }) {
  const params = new URLSearchParams();
  if (filter?.groupId) params.set('groupId', filter.groupId);
  if (filter?.kind) params.set('kind', filter.kind);
  const query = params.toString();
  return useQuery({
    queryKey: [...CATEGORIES_KEY, { groupId: filter?.groupId, kind: filter?.kind }] as const,
    queryFn: async (): Promise<BudgetCategory[]> => {
      const res = await api.get(`/budget/categories${query ? `?${query}` : ''}`);
      return res.data;
    },
  });
}

type CreateCategoryBody = {
  groupId: string;
  name: string;
  kind: CategoryKind;
  color?: string;
};
type UpdateCategoryBody = {
  groupId?: string;
  name?: string;
  kind?: CategoryKind;
  color?: string | null;
  archived?: boolean;
};

export function useCreateBudgetCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateCategoryBody): Promise<BudgetCategory> => {
      const res = await api.post('/budget/categories', body);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CATEGORIES_KEY });
      qc.invalidateQueries({ queryKey: REPORT_PREFIX });
    },
    onError: (err) => toastError('Could not create category', err),
  });
}

export function useUpdateBudgetCategory(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: UpdateCategoryBody): Promise<BudgetCategory> => {
      const res = await api.patch(`/budget/categories/${id}`, body);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CATEGORIES_KEY });
      qc.invalidateQueries({ queryKey: REPORT_PREFIX });
    },
    onError: (err) => toastError('Could not update category', err),
  });
}

export function useArchiveBudgetCategory(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<BudgetCategory> => {
      const res = await api.delete(`/budget/categories/${id}`);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CATEGORIES_KEY });
      qc.invalidateQueries({ queryKey: REPORT_PREFIX });
    },
    onError: (err) => toastError('Could not archive category', err),
  });
}

export function useReorderBudgetCategories(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]): Promise<BudgetCategory[]> => {
      const res = await api.patch('/budget/categories/reorder', {
        groupId,
        ids,
      });
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CATEGORIES_KEY });
      qc.invalidateQueries({ queryKey: REPORT_PREFIX });
    },
    onError: (err) => toastError('Could not reorder categories', err),
  });
}

// ---- Transactions ----

export function useBudgetTransactions(month: string) {
  return useQuery({
    queryKey: TRANSACTIONS_KEY(month),
    queryFn: async (): Promise<BudgetTransaction[]> => {
      const res = await api.get(`/budget/transactions?month=${month}`);
      return res.data;
    },
  });
}

type CreateTransactionBody = {
  date: Date;
  categoryId: string;
  amount: number;
  description?: string;
};
type UpdateTransactionBody = {
  date?: Date;
  categoryId?: string;
  amount?: number;
  description?: string | null;
};

export function useCreateBudgetTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateTransactionBody): Promise<BudgetTransaction> => {
      const res = await api.post('/budget/transactions', body);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: TRANSACTIONS_PREFIX });
      qc.invalidateQueries({ queryKey: REPORT_PREFIX });
    },
    onError: (err) => toastError('Could not add transaction', err),
  });
}

export function useUpdateBudgetTransaction(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: UpdateTransactionBody): Promise<BudgetTransaction> => {
      const res = await api.patch(`/budget/transactions/${id}`, body);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: TRANSACTIONS_PREFIX });
      qc.invalidateQueries({ queryKey: REPORT_PREFIX });
    },
    onError: (err) => toastError('Could not update transaction', err),
  });
}

export function useDeleteBudgetTransaction(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await api.delete(`/budget/transactions/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: TRANSACTIONS_PREFIX });
      qc.invalidateQueries({ queryKey: REPORT_PREFIX });
    },
    onError: (err) => toastError('Could not delete transaction', err),
  });
}

// ---- Targets ----

export function useBudgetTargets(month: string) {
  return useQuery({
    queryKey: TARGETS_KEY(month),
    queryFn: async (): Promise<BudgetTarget[]> => {
      const res = await api.get(`/budget/targets?month=${month}`);
      return res.data;
    },
  });
}

type BulkUpsertTargetsBody = {
  month: string;
  items: Array<{ categoryId: string; amount: number }>;
};

export function useBulkUpsertTargets() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: BulkUpsertTargetsBody): Promise<BudgetTarget[]> => {
      const res = await api.put('/budget/targets', body);
      return res.data;
    },
    onSuccess: (_fresh, vars) => {
      qc.invalidateQueries({ queryKey: TARGETS_KEY(vars.month) });
      qc.invalidateQueries({ queryKey: REPORT_KEY(vars.month) });
    },
    onError: (err) => toastError('Could not save targets', err),
  });
}

// ---- Recurring ----

export function useBudgetRecurring() {
  return useQuery({
    queryKey: RECURRING_KEY,
    queryFn: async (): Promise<BudgetRecurringTemplate[]> => {
      const res = await api.get('/budget/recurring');
      return res.data;
    },
  });
}

type CreateRecurringBody = {
  label: string;
  categoryId: string;
  amount: number;
  cadence: 'monthly';
  dayOfMonth: number;
  active?: boolean;
};
type UpdateRecurringBody = {
  label?: string;
  categoryId?: string;
  amount?: number;
  dayOfMonth?: number;
  active?: boolean;
};

export function useCreateBudgetRecurring() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateRecurringBody): Promise<BudgetRecurringTemplate> => {
      const res = await api.post('/budget/recurring', body);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: RECURRING_KEY });
      qc.invalidateQueries({ queryKey: REPORT_PREFIX });
    },
    onError: (err) => toastError('Could not create template', err),
  });
}

export function useUpdateBudgetRecurring(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: UpdateRecurringBody): Promise<BudgetRecurringTemplate> => {
      const res = await api.patch(`/budget/recurring/${id}`, body);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: RECURRING_KEY });
      qc.invalidateQueries({ queryKey: REPORT_PREFIX });
    },
    onError: (err) => toastError('Could not update template', err),
  });
}

export function useDeleteBudgetRecurring(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await api.delete(`/budget/recurring/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: RECURRING_KEY });
      qc.invalidateQueries({ queryKey: REPORT_PREFIX });
    },
    onError: (err) => toastError('Could not delete template', err),
  });
}

export function useApplyBudgetRecurring(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<BudgetTransaction> => {
      const res = await api.post(`/budget/recurring/${id}/apply`);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: RECURRING_KEY });
      qc.invalidateQueries({ queryKey: TRANSACTIONS_PREFIX });
      qc.invalidateQueries({ queryKey: REPORT_PREFIX });
    },
    onError: (err) => toastError('Could not apply template', err),
  });
}

// ---- Report (drives the report page and the dashboard widget) ----

export function useBudgetReport(month: string) {
  return useQuery({
    queryKey: REPORT_KEY(month),
    queryFn: async (): Promise<BudgetReport> => {
      const res = await api.get(`/budget/report?month=${month}`);
      return res.data;
    },
  });
}
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit -p apps/web/tsconfig.json`
Expected: no errors. Pre-existing journal-helpers.test.ts errors are in the API tsconfig, not web.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/budget-month.ts apps/web/src/lib/budget-formatting.ts apps/web/src/hooks/useBudget.ts
git commit -m "$(cat <<'EOF'
feat(web): add useBudget hooks and budget formatting/month utilities

Single useBudget.ts owning all server state behind TanStack Query keys
(['budget', 'groups'|'categories'|'transactions'|'targets'|'recurring'|'report']),
mutations with cross-key invalidation, and a sonner-based toast error
helper mirroring useJobs.ts. Money + month formatting helpers handle
INR vs US grouping and YYYY-MM ↔ "Month YYYY" conversion at the
display edge.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2 — Navbar entry, routes scaffold, tab strip, placeholder pages

**Files:**
- Modify: `apps/web/src/components/Navbar.tsx`
- Modify: `apps/web/src/App.tsx`
- Create: `apps/web/src/components/budget/BudgetTabStrip.tsx`
- Create: `apps/web/src/pages/BudgetPage.tsx`
- Create: `apps/web/src/pages/BudgetPlanPage.tsx`
- Create: `apps/web/src/pages/BudgetReportPage.tsx`
- Create: `apps/web/src/pages/BudgetCategoriesPage.tsx`
- Create: `apps/web/src/pages/BudgetRecurringPage.tsx`
- Create: `apps/web/src/pages/BudgetSettingsPage.tsx`

- [ ] **Step 1: Add a Budget link in `apps/web/src/components/Navbar.tsx`**

In the `<nav>` element inside the header, add a Budget link after the Jobs link. The relevant block becomes:

```tsx
          <nav className="flex items-center gap-5 text-sm text-slate-600 dark:text-slate-400">
            <Link to="/roadmaps" data-tour="nav-roadmaps" className="hover:text-slate-900 dark:hover:text-slate-100 transition-colors">
              Roadmaps
            </Link>
            <Link to="/journal" data-tour="nav-journal" className="hover:text-slate-900 dark:hover:text-slate-100 transition-colors">
              Journal
            </Link>
            <Link to="/jobs" data-tour="nav-jobs" className="hover:text-slate-900 dark:hover:text-slate-100 transition-colors">
              Jobs
            </Link>
            <Link to="/budget" className="hover:text-slate-900 dark:hover:text-slate-100 transition-colors">
              Budget
            </Link>
          </nav>
```

No `data-tour` marker on Budget — onboarding tour doesn't cover Budget in v1.

- [ ] **Step 2: Create `apps/web/src/components/budget/BudgetTabStrip.tsx`**

```tsx
import { NavLink } from 'react-router-dom';

const TABS = [
  { to: '/budget', label: 'Log', end: true },
  { to: '/budget/plan', label: 'Plan' },
  { to: '/budget/report', label: 'Report' },
  { to: '/budget/categories', label: 'Categories' },
  { to: '/budget/recurring', label: 'Recurring' },
  { to: '/budget/settings', label: 'Settings' },
] as const;

/**
 * Sub-navigation for every /budget/* route. NavLink's `end` prop on the
 * /budget tab ensures it only highlights for the exact base path, not for
 * /budget/plan etc.
 */
export function BudgetTabStrip() {
  return (
    <nav className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-800 mb-6">
      {TABS.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={'end' in tab ? tab.end : false}
          className={({ isActive }) =>
            `px-3 py-2 text-sm transition-colors border-b-2 -mb-px ${
              isActive
                ? 'border-sky-500 text-slate-900 dark:text-slate-100'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
            }`
          }
        >
          {tab.label}
        </NavLink>
      ))}
    </nav>
  );
}
```

- [ ] **Step 3: Create the six page files as placeholders**

Each page must render `<BudgetTabStrip />` plus a one-line marker that the page is reachable. Real content lands in Tasks 3-8. Use this exact template, swapping the name + heading per file:

For `apps/web/src/pages/BudgetPage.tsx`:

```tsx
import { BudgetTabStrip } from '@/components/budget/BudgetTabStrip';

export default function BudgetPage() {
  return (
    <main className="container py-10">
      <h1 className="text-2xl font-semibold tracking-tight mb-6">Budget</h1>
      <BudgetTabStrip />
      <p className="text-sm text-slate-500">Log placeholder — main page lands in Task 5.</p>
    </main>
  );
}
```

For `apps/web/src/pages/BudgetPlanPage.tsx`:

```tsx
import { BudgetTabStrip } from '@/components/budget/BudgetTabStrip';

export default function BudgetPlanPage() {
  return (
    <main className="container py-10">
      <h1 className="text-2xl font-semibold tracking-tight mb-6">Budget</h1>
      <BudgetTabStrip />
      <p className="text-sm text-slate-500">Plan placeholder — lands in Task 6.</p>
    </main>
  );
}
```

For `apps/web/src/pages/BudgetReportPage.tsx`:

```tsx
import { BudgetTabStrip } from '@/components/budget/BudgetTabStrip';

export default function BudgetReportPage() {
  return (
    <main className="container py-10">
      <h1 className="text-2xl font-semibold tracking-tight mb-6">Budget</h1>
      <BudgetTabStrip />
      <p className="text-sm text-slate-500">Report placeholder — lands in Task 8.</p>
    </main>
  );
}
```

For `apps/web/src/pages/BudgetCategoriesPage.tsx`:

```tsx
import { BudgetTabStrip } from '@/components/budget/BudgetTabStrip';

export default function BudgetCategoriesPage() {
  return (
    <main className="container py-10">
      <h1 className="text-2xl font-semibold tracking-tight mb-6">Budget</h1>
      <BudgetTabStrip />
      <p className="text-sm text-slate-500">Categories placeholder — lands in Task 4.</p>
    </main>
  );
}
```

For `apps/web/src/pages/BudgetRecurringPage.tsx`:

```tsx
import { BudgetTabStrip } from '@/components/budget/BudgetTabStrip';

export default function BudgetRecurringPage() {
  return (
    <main className="container py-10">
      <h1 className="text-2xl font-semibold tracking-tight mb-6">Budget</h1>
      <BudgetTabStrip />
      <p className="text-sm text-slate-500">Recurring placeholder — lands in Task 7.</p>
    </main>
  );
}
```

For `apps/web/src/pages/BudgetSettingsPage.tsx`:

```tsx
import { BudgetTabStrip } from '@/components/budget/BudgetTabStrip';

export default function BudgetSettingsPage() {
  return (
    <main className="container py-10">
      <h1 className="text-2xl font-semibold tracking-tight mb-6">Budget</h1>
      <BudgetTabStrip />
      <p className="text-sm text-slate-500">Settings placeholder — lands in Task 3.</p>
    </main>
  );
}
```

- [ ] **Step 4: Register the six routes in `apps/web/src/App.tsx`**

Add the imports near the other page imports:

```tsx
import BudgetPage from '@/pages/BudgetPage';
import BudgetPlanPage from '@/pages/BudgetPlanPage';
import BudgetReportPage from '@/pages/BudgetReportPage';
import BudgetCategoriesPage from '@/pages/BudgetCategoriesPage';
import BudgetRecurringPage from '@/pages/BudgetRecurringPage';
import BudgetSettingsPage from '@/pages/BudgetSettingsPage';
```

Add the six `<Route>` elements inside `<Routes>`, right after the `/journal` route:

```tsx
        <Route path="/budget" element={<Protected><BudgetPage /></Protected>} />
        <Route path="/budget/plan" element={<Protected><BudgetPlanPage /></Protected>} />
        <Route path="/budget/report" element={<Protected><BudgetReportPage /></Protected>} />
        <Route path="/budget/categories" element={<Protected><BudgetCategoriesPage /></Protected>} />
        <Route path="/budget/recurring" element={<Protected><BudgetRecurringPage /></Protected>} />
        <Route path="/budget/settings" element={<Protected><BudgetSettingsPage /></Protected>} />
```

The wildcard `<Route path="*">` remains at the bottom.

- [ ] **Step 5: Manual smoke**

Run `npm run dev --workspace=apps/web` (or whatever's currently used to start vite — check `apps/web/package.json` scripts; it's `npm run dev`). Open the dashboard, log in as a dev user. Click the new "Budget" link in the navbar. Verify:
- `/budget` renders with the tab strip + "Log placeholder" text.
- Each tab navigates to the corresponding page with its placeholder text.
- The active tab is underlined sky-500.

Stop the dev server after verifying. No automated test step at this stage — placeholders are visually verified only.

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit -p apps/web/tsconfig.json`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/Navbar.tsx apps/web/src/App.tsx apps/web/src/components/budget/BudgetTabStrip.tsx apps/web/src/pages/BudgetPage.tsx apps/web/src/pages/BudgetPlanPage.tsx apps/web/src/pages/BudgetReportPage.tsx apps/web/src/pages/BudgetCategoriesPage.tsx apps/web/src/pages/BudgetRecurringPage.tsx apps/web/src/pages/BudgetSettingsPage.tsx
git commit -m "$(cat <<'EOF'
feat(web): scaffold Budget routes and navbar entry

Adds the Budget link to the navbar, six placeholder pages under
/budget/*, and a shared BudgetTabStrip used by every sub-route.
Real content lands in subsequent commits.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3 — Settings page (currency selector)

**Files:**
- Modify: `apps/web/src/hooks/useAuth.ts`
- Create: `apps/web/src/components/budget/BudgetCurrencySelector.tsx`
- Modify: `apps/web/src/pages/BudgetSettingsPage.tsx`

- [ ] **Step 1: [Read first] Inspect the existing auth hook**

Read `apps/web/src/hooks/useAuth.ts` end-to-end. Note how `useMe` is exposed and how `useLogout` shapes a mutation. The new `useUpdateMe` follows the same shape and calls `PATCH /api/auth/me` (already supports `currency` on the backend).

- [ ] **Step 2: Add `useUpdateMe` to `apps/web/src/hooks/useAuth.ts`**

Append at the bottom of the file:

```typescript
import { useMutation } from '@tanstack/react-query'; // ensure this is already imported; add only if missing
import { AxiosError } from 'axios';                  // same — ensure imported
import { toast } from 'sonner';                      // same

// (If the file already has these imports at the top, do NOT re-import — just add the export below.)

type UpdateMeBody = {
  timezone?: string | null;
  currency?: string;
};

export function useUpdateMe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: UpdateMeBody) => {
      const res = await api.patch('/auth/me', body);
      return res.data;
    },
    onSuccess: (fresh) => {
      qc.setQueryData(['auth', 'me'], fresh);
    },
    onError: (err) => {
      const fallback = 'Could not save profile';
      if (err instanceof AxiosError) {
        const data = err.response?.data as { error?: string; message?: string } | undefined;
        toast.error(data?.error ?? data?.message ?? fallback);
        return;
      }
      toast.error(fallback);
    },
  });
}
```

Inspect the existing imports at the top of `useAuth.ts` first. Add only the imports that aren't already there (`useMutation`, `useQueryClient`, `AxiosError`, `toast`). The `api` import already exists.

- [ ] **Step 3: Create `apps/web/src/components/budget/BudgetCurrencySelector.tsx`**

```tsx
import { COMMON_CURRENCIES } from '@pathforge/shared';
import { useMe } from '@/hooks/useAuth';
import { useUpdateMe } from '@/hooks/useAuth';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/**
 * Currency picker driven by /api/auth/me. The User shape exposes `currency`
 * as optional in the Zod schema, but the server always echoes 'INR' for
 * legacy users — so the local fallback below mirrors that.
 */
export function BudgetCurrencySelector() {
  const { data: me } = useMe();
  const updateMe = useUpdateMe();

  const current = me?.currency ?? 'INR';

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-6 max-w-md">
      <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-1">
        Currency
      </h2>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
        The currency symbol and digit grouping used everywhere in Budget.
        Changing this does not convert any existing amounts.
      </p>
      <Select
        value={current}
        onValueChange={(value) => {
          if (value === current) return;
          updateMe.mutate({ currency: value });
        }}
      >
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {COMMON_CURRENCIES.map((code) => (
            <SelectItem key={code} value={code}>
              {code}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
```

- [ ] **Step 4: Wire the selector into `apps/web/src/pages/BudgetSettingsPage.tsx`**

Replace the page contents with:

```tsx
import { BudgetTabStrip } from '@/components/budget/BudgetTabStrip';
import { BudgetCurrencySelector } from '@/components/budget/BudgetCurrencySelector';

export default function BudgetSettingsPage() {
  return (
    <main className="container py-10">
      <h1 className="text-2xl font-semibold tracking-tight mb-6">Budget</h1>
      <BudgetTabStrip />
      <BudgetCurrencySelector />
    </main>
  );
}
```

- [ ] **Step 5: Manual smoke**

Start the dev server, navigate to `/budget/settings`, change the currency from INR → USD → INR. After each change, refresh — the picker should still show the latest choice.

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit -p apps/web/tsconfig.json`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/hooks/useAuth.ts apps/web/src/components/budget/BudgetCurrencySelector.tsx apps/web/src/pages/BudgetSettingsPage.tsx
git commit -m "$(cat <<'EOF'
feat(web): add currency selector on /budget/settings

Adds useUpdateMe to useAuth.ts and a BudgetCurrencySelector card on the
settings sub-page. Wired against the existing PATCH /api/auth/me handler
(which already accepts currency). Persists immediately on change; no
"Save" button needed since the surface is single-field.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4 — Categories management page (groups + categories CRUD + drag-to-reorder)

**Files:**
- Create: `apps/web/src/components/budget/BudgetGroupDialog.tsx`
- Create: `apps/web/src/components/budget/BudgetCategoryDialog.tsx`
- Create: `apps/web/src/components/budget/BudgetDeleteGroupConfirm.tsx`
- Create: `apps/web/src/components/budget/BudgetDeleteCategoryConfirm.tsx`
- Create: `apps/web/src/components/budget/BudgetGroupList.tsx`
- Create: `apps/web/src/components/budget/BudgetCategoryList.tsx`
- Modify: `apps/web/src/pages/BudgetCategoriesPage.tsx`

- [ ] **Step 1: [Read first] Reference existing drag-to-reorder + dialog patterns**

Read `apps/web/src/components/roadmaps/MilestoneList.tsx` (or any existing list using `@dnd-kit`) for the reorder pattern. Read `apps/web/src/components/jobs/NewJobDialog.tsx` for the dialog form pattern with React Hook Form. Read `apps/web/src/components/jobs/DeleteJobConfirm.tsx` for the confirm-dialog pattern.

- [ ] **Step 2: Create `apps/web/src/components/budget/BudgetGroupDialog.tsx`**

```tsx
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { BudgetCategoryGroup } from '@pathforge/shared';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  useCreateBudgetGroup,
  useUpdateBudgetGroup,
} from '@/hooks/useBudget';

const GROUP_COLORS = [
  '#10b981', // emerald
  '#ef4444', // red
  '#f59e0b', // amber
  '#dc2626', // red-600
  '#8b5cf6', // violet
  '#0ea5e9', // sky
  '#64748b', // slate
  '#ec4899', // pink
] as const;

const Schema = z.object({
  name: z.string().min(1, 'Required').max(80),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Invalid hex color'),
});
type FormValues = z.infer<typeof Schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When set, the dialog is in edit mode for this group. */
  group?: BudgetCategoryGroup;
}

export function BudgetGroupDialog({ open, onOpenChange, group }: Props) {
  const create = useCreateBudgetGroup();
  const update = useUpdateBudgetGroup(group?._id ?? '');

  const form = useForm<FormValues>({
    resolver: zodResolver(Schema),
    defaultValues: {
      name: group?.name ?? '',
      color: group?.color ?? GROUP_COLORS[0],
    },
  });

  // Reset when the editing target changes or the dialog re-opens.
  useEffect(() => {
    if (open) {
      form.reset({
        name: group?.name ?? '',
        color: group?.color ?? GROUP_COLORS[0],
      });
    }
  }, [open, group, form]);

  const submitting = create.isPending || update.isPending;

  async function onSubmit(values: FormValues) {
    if (group) {
      await update.mutateAsync(values);
    } else {
      await create.mutateAsync(values);
    }
    onOpenChange(false);
  }

  const selectedColor = form.watch('color');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{group ? 'Edit group' : 'New group'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
              Name
            </label>
            <Input
              {...form.register('name')}
              placeholder="Bills, Household, Income…"
              autoFocus
            />
            {form.formState.errors.name && (
              <p className="text-xs text-red-600">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
              Color
            </label>
            <div className="flex gap-2">
              {GROUP_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => form.setValue('color', color, { shouldValidate: true })}
                  className={`h-8 w-8 rounded-full border-2 transition-transform ${
                    selectedColor === color
                      ? 'border-slate-900 dark:border-slate-100 scale-110'
                      : 'border-transparent hover:scale-105'
                  }`}
                  style={{ backgroundColor: color }}
                  aria-label={`Pick color ${color}`}
                />
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {group ? 'Save' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: Create `apps/web/src/components/budget/BudgetCategoryDialog.tsx`**

```tsx
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { BudgetCategory, BudgetCategoryGroup } from '@pathforge/shared';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useCreateBudgetCategory,
  useUpdateBudgetCategory,
} from '@/hooks/useBudget';

const Schema = z.object({
  groupId: z.string().min(1, 'Pick a group'),
  name: z.string().min(1, 'Required').max(80),
  kind: z.enum(['income', 'expense']),
});
type FormValues = z.infer<typeof Schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: BudgetCategoryGroup[];
  /** Pre-select this group when creating. */
  defaultGroupId?: string;
  /** When set, dialog is in edit mode. */
  category?: BudgetCategory;
}

export function BudgetCategoryDialog({
  open,
  onOpenChange,
  groups,
  defaultGroupId,
  category,
}: Props) {
  const create = useCreateBudgetCategory();
  const update = useUpdateBudgetCategory(category?._id ?? '');

  const form = useForm<FormValues>({
    resolver: zodResolver(Schema),
    defaultValues: {
      groupId: category?.groupId ?? defaultGroupId ?? groups[0]?._id ?? '',
      name: category?.name ?? '',
      kind: category?.kind ?? 'expense',
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        groupId: category?.groupId ?? defaultGroupId ?? groups[0]?._id ?? '',
        name: category?.name ?? '',
        kind: category?.kind ?? 'expense',
      });
    }
  }, [open, category, defaultGroupId, groups, form]);

  const submitting = create.isPending || update.isPending;

  async function onSubmit(values: FormValues) {
    if (category) {
      await update.mutateAsync(values);
    } else {
      await create.mutateAsync(values);
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{category ? 'Edit category' : 'New category'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
              Group
            </label>
            <Select
              value={form.watch('groupId')}
              onValueChange={(v) => form.setValue('groupId', v, { shouldValidate: true })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {groups.map((g) => (
                  <SelectItem key={g._id} value={g._id}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.groupId && (
              <p className="text-xs text-red-600">
                {form.formState.errors.groupId.message}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
              Name
            </label>
            <Input
              {...form.register('name')}
              placeholder="Groceries, Salary…"
              autoFocus
            />
            {form.formState.errors.name && (
              <p className="text-xs text-red-600">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
              Kind
            </label>
            <Select
              value={form.watch('kind')}
              onValueChange={(v) =>
                form.setValue('kind', v as 'income' | 'expense', { shouldValidate: true })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="expense">Expense</SelectItem>
                <SelectItem value="income">Income</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {category ? 'Save' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: Create the two confirm dialogs**

`apps/web/src/components/budget/BudgetDeleteGroupConfirm.tsx`:

```tsx
import type { BudgetCategoryGroup } from '@pathforge/shared';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useArchiveBudgetGroup } from '@/hooks/useBudget';

interface Props {
  group: BudgetCategoryGroup | null;
  onClose: () => void;
}

export function BudgetDeleteGroupConfirm({ group, onClose }: Props) {
  const archive = useArchiveBudgetGroup(group?._id ?? '');

  if (!group) return null;

  async function onConfirm() {
    await archive.mutateAsync();
    onClose();
  }

  return (
    <Dialog open={!!group} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Archive “{group.name}”?</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Archived groups are hidden from the input dropdown but stay visible
          in historical month reports. You'll get an error if this group still
          has any live categories — move or archive them first.
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={archive.isPending}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={archive.isPending}>
            Archive
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

`apps/web/src/components/budget/BudgetDeleteCategoryConfirm.tsx`:

```tsx
import type { BudgetCategory } from '@pathforge/shared';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useArchiveBudgetCategory } from '@/hooks/useBudget';

interface Props {
  category: BudgetCategory | null;
  onClose: () => void;
}

export function BudgetDeleteCategoryConfirm({ category, onClose }: Props) {
  const archive = useArchiveBudgetCategory(category?._id ?? '');

  if (!category) return null;

  async function onConfirm() {
    await archive.mutateAsync();
    onClose();
  }

  return (
    <Dialog open={!!category} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Archive “{category.name}”?</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Archived categories disappear from the input dropdown but their past
          transactions remain in historical reports (greyed). You can't hard-delete
          a category — archive is the only option.
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={archive.isPending}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={archive.isPending}>
            Archive
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 5: Create `apps/web/src/components/budget/BudgetGroupList.tsx`**

This is the LEFT pane of the categories page. It uses `@dnd-kit/sortable` for drag-to-reorder. Mirrors the existing roadmap milestone list pattern. Selected group is highlighted; clicking selects.

```tsx
import { useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Pencil, Archive, Plus } from 'lucide-react';
import type { BudgetCategoryGroup } from '@pathforge/shared';
import { Button } from '@/components/ui/button';
import { useReorderBudgetGroups } from '@/hooks/useBudget';
import { BudgetGroupDialog } from './BudgetGroupDialog';
import { BudgetDeleteGroupConfirm } from './BudgetDeleteGroupConfirm';

interface Props {
  groups: BudgetCategoryGroup[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function BudgetGroupList({ groups, selectedId, onSelect }: Props) {
  const [newOpen, setNewOpen] = useState(false);
  const [editing, setEditing] = useState<BudgetCategoryGroup | undefined>();
  const [archiving, setArchiving] = useState<BudgetCategoryGroup | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const reorder = useReorderBudgetGroups();

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = groups.findIndex((g) => g._id === active.id);
    const newIndex = groups.findIndex((g) => g._id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(groups, oldIndex, newIndex);
    reorder.mutate(reordered.map((g) => g._id));
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          Groups
        </h2>
        <Button size="sm" variant="ghost" onClick={() => setNewOpen(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" /> New
        </Button>
      </div>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
      >
        <SortableContext
          items={groups.map((g) => g._id)}
          strategy={verticalListSortingStrategy}
        >
          <ul className="space-y-1">
            {groups.map((g) => (
              <GroupRow
                key={g._id}
                group={g}
                selected={g._id === selectedId}
                onSelect={() => onSelect(g._id)}
                onEdit={() => setEditing(g)}
                onArchive={() => setArchiving(g)}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
      <BudgetGroupDialog open={newOpen} onOpenChange={setNewOpen} />
      <BudgetGroupDialog
        open={!!editing}
        onOpenChange={(open) => !open && setEditing(undefined)}
        group={editing}
      />
      <BudgetDeleteGroupConfirm
        group={archiving}
        onClose={() => setArchiving(null)}
      />
    </div>
  );
}

interface GroupRowProps {
  group: BudgetCategoryGroup;
  selected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onArchive: () => void;
}

function GroupRow({ group, selected, onSelect, onEdit, onArchive }: GroupRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: group._id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`group flex items-center gap-2 px-2 py-2 rounded-md cursor-pointer transition-colors ${
        selected
          ? 'bg-slate-100 dark:bg-slate-800'
          : 'hover:bg-slate-50 dark:hover:bg-slate-900'
      }`}
      onClick={onSelect}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="touch-none text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
        aria-label="Drag to reorder"
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span
        className="h-3 w-3 rounded-full shrink-0"
        style={{ backgroundColor: group.color }}
      />
      <span className="flex-1 text-sm text-slate-900 dark:text-slate-100 truncate">
        {group.name}
      </span>
      <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          className="p-1 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
          aria-label="Edit group"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onArchive();
          }}
          className="p-1 text-slate-500 hover:text-red-600"
          aria-label="Archive group"
        >
          <Archive className="h-3.5 w-3.5" />
        </button>
      </div>
    </li>
  );
}
```

- [ ] **Step 6: Create `apps/web/src/components/budget/BudgetCategoryList.tsx`**

The RIGHT pane — categories within the selected group. Drag-reorder within the group only. Empty state if no group is selected or selected group has no categories.

```tsx
import { useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Pencil, Archive, Plus } from 'lucide-react';
import type {
  BudgetCategory,
  BudgetCategoryGroup,
} from '@pathforge/shared';
import { Button } from '@/components/ui/button';
import {
  useBudgetCategories,
  useReorderBudgetCategories,
} from '@/hooks/useBudget';
import { BudgetCategoryDialog } from './BudgetCategoryDialog';
import { BudgetDeleteCategoryConfirm } from './BudgetDeleteCategoryConfirm';

interface Props {
  selectedGroup: BudgetCategoryGroup | null;
  groups: BudgetCategoryGroup[];
}

export function BudgetCategoryList({ selectedGroup, groups }: Props) {
  const [newOpen, setNewOpen] = useState(false);
  const [editing, setEditing] = useState<BudgetCategory | undefined>();
  const [archiving, setArchiving] = useState<BudgetCategory | null>(null);

  const { data: allCategories = [] } = useBudgetCategories();
  // Show non-archived only; the categories management page is for live items.
  // (Archived items are intentionally hidden — re-introduce a toggle later if needed.)
  const liveInGroup = selectedGroup
    ? allCategories.filter(
        (c) => c.groupId === selectedGroup._id && !c.archived
      )
    : [];

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const reorder = useReorderBudgetCategories(selectedGroup?._id ?? '');

  function onDragEnd(event: DragEndEvent) {
    if (!selectedGroup) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = liveInGroup.findIndex((c) => c._id === active.id);
    const newIndex = liveInGroup.findIndex((c) => c._id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(liveInGroup, oldIndex, newIndex);
    reorder.mutate(reordered.map((c) => c._id));
  }

  if (!selectedGroup) {
    return (
      <div className="text-sm text-slate-500 dark:text-slate-400">
        Pick a group on the left to see its categories.
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            {selectedGroup.name}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {liveInGroup.length} {liveInGroup.length === 1 ? 'category' : 'categories'}
          </p>
        </div>
        <Button size="sm" variant="ghost" onClick={() => setNewOpen(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" /> New
        </Button>
      </div>

      {liveInGroup.length === 0 ? (
        <div className="text-sm text-slate-500 dark:text-slate-400 px-2 py-4">
          No categories in this group yet.
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
        >
          <SortableContext
            items={liveInGroup.map((c) => c._id)}
            strategy={verticalListSortingStrategy}
          >
            <ul className="space-y-1">
              {liveInGroup.map((c) => (
                <CategoryRow
                  key={c._id}
                  category={c}
                  groupColor={selectedGroup.color}
                  onEdit={() => setEditing(c)}
                  onArchive={() => setArchiving(c)}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      <BudgetCategoryDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        groups={groups}
        defaultGroupId={selectedGroup._id}
      />
      <BudgetCategoryDialog
        open={!!editing}
        onOpenChange={(open) => !open && setEditing(undefined)}
        groups={groups}
        category={editing}
      />
      <BudgetDeleteCategoryConfirm
        category={archiving}
        onClose={() => setArchiving(null)}
      />
    </div>
  );
}

interface CategoryRowProps {
  category: BudgetCategory;
  groupColor: string;
  onEdit: () => void;
  onArchive: () => void;
}

function CategoryRow({ category, groupColor, onEdit, onArchive }: CategoryRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: category._id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const color = category.color ?? groupColor;

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="group flex items-center gap-2 px-2 py-2 rounded-md hover:bg-slate-50 dark:hover:bg-slate-900"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="touch-none text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span
        className="h-2.5 w-2.5 rounded-full shrink-0"
        style={{ backgroundColor: color }}
      />
      <span className="flex-1 text-sm text-slate-900 dark:text-slate-100 truncate">
        {category.name}
      </span>
      <span className="text-[11px] text-slate-500 capitalize">
        {category.kind}
      </span>
      <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          type="button"
          onClick={onEdit}
          className="p-1 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
          aria-label="Edit category"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onArchive}
          className="p-1 text-slate-500 hover:text-red-600"
          aria-label="Archive category"
        >
          <Archive className="h-3.5 w-3.5" />
        </button>
      </div>
    </li>
  );
}
```

- [ ] **Step 7: Wire the two panes into `apps/web/src/pages/BudgetCategoriesPage.tsx`**

Replace the page contents with:

```tsx
import { useEffect, useMemo, useState } from 'react';
import { BudgetTabStrip } from '@/components/budget/BudgetTabStrip';
import { BudgetGroupList } from '@/components/budget/BudgetGroupList';
import { BudgetCategoryList } from '@/components/budget/BudgetCategoryList';
import { useBudgetGroups } from '@/hooks/useBudget';

export default function BudgetCategoriesPage() {
  const { data: groups = [], isPending } = useBudgetGroups();
  const liveGroups = useMemo(
    () => groups.filter((g) => !g.archived),
    [groups]
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Auto-select the first group as soon as data loads (or when the previous
  // selection is no longer in the live set).
  useEffect(() => {
    if (liveGroups.length === 0) {
      if (selectedId !== null) setSelectedId(null);
      return;
    }
    if (!selectedId || !liveGroups.some((g) => g._id === selectedId)) {
      setSelectedId(liveGroups[0]!._id);
    }
  }, [liveGroups, selectedId]);

  const selected = liveGroups.find((g) => g._id === selectedId) ?? null;

  return (
    <main className="container py-10">
      <h1 className="text-2xl font-semibold tracking-tight mb-6">Budget</h1>
      <BudgetTabStrip />
      {isPending ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <div className="grid grid-cols-[280px_1fr] gap-8 items-start">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-4">
            <BudgetGroupList
              groups={liveGroups}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-4">
            <BudgetCategoryList
              selectedGroup={selected}
              groups={liveGroups}
            />
          </div>
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 8: Manual smoke**

Start the dev server. Navigate to `/budget/categories`. Verify:
- The seven seeded groups appear in the left pane.
- Selecting a group shows its categories in the right pane.
- "+ New" on the left creates a group; the group appears at the end and is selectable.
- "+ New" on the right creates a category in the selected group.
- Edit affordances open the right dialog with prefilled values.
- Archive on a group with live categories shows the 409 toast ("Move or archive this group's categories…").
- Drag-and-drop reorders groups and categories.

- [ ] **Step 9: Typecheck**

Run: `npx tsc --noEmit -p apps/web/tsconfig.json`
Expected: no errors.

- [ ] **Step 10: Commit**

```bash
git add apps/web/src/components/budget/BudgetGroupDialog.tsx apps/web/src/components/budget/BudgetCategoryDialog.tsx apps/web/src/components/budget/BudgetDeleteGroupConfirm.tsx apps/web/src/components/budget/BudgetDeleteCategoryConfirm.tsx apps/web/src/components/budget/BudgetGroupList.tsx apps/web/src/components/budget/BudgetCategoryList.tsx apps/web/src/pages/BudgetCategoriesPage.tsx
git commit -m "$(cat <<'EOF'
feat(web): add /budget/categories page with groups + categories management

Two-pane layout: groups on the left, categories within the selected
group on the right. Both lists support drag-to-reorder via @dnd-kit,
inline edit/archive affordances on hover, and modal create/edit dialogs.
Archive-with-live-children surfaces the server's 409 via the existing
toast helper.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5 — Main log page: month selector + input row + two-column log + net band

**Files:**
- Create: `apps/web/src/components/budget/BudgetMonthSelector.tsx`
- Create: `apps/web/src/components/budget/BudgetNetBand.tsx`
- Create: `apps/web/src/components/budget/BudgetInputRow.tsx`
- Create: `apps/web/src/components/budget/BudgetTransactionRow.tsx`
- Create: `apps/web/src/components/budget/BudgetEditTransactionDialog.tsx`
- Create: `apps/web/src/components/budget/BudgetLogColumn.tsx`
- Modify: `apps/web/src/pages/BudgetPage.tsx`

- [ ] **Step 1: Create `apps/web/src/components/budget/BudgetMonthSelector.tsx`**

```tsx
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { addMonths, formatMonthLabel } from '@/lib/budget-month';
import { Button } from '@/components/ui/button';

interface Props {
  month: string;
  onChange: (month: string) => void;
}

export function BudgetMonthSelector({ month, onChange }: Props) {
  return (
    <div className="inline-flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onChange(addMonths(month, -1))}
        aria-label="Previous month"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <div className="px-3 text-base font-medium text-slate-900 dark:text-slate-100 tabular-nums">
        {formatMonthLabel(month)}
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onChange(addMonths(month, 1))}
        aria-label="Next month"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Create `apps/web/src/components/budget/BudgetNetBand.tsx`**

```tsx
import { formatMoney } from '@/lib/budget-formatting';

interface Props {
  income: number;
  expense: number;
  net: number;
  currency: string;
}

export function BudgetNetBand({ income, expense, net, currency }: Props) {
  const netColor = net >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400';
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-4 py-3 flex items-center gap-6">
      <Stat label="Income" value={formatMoney(income, currency)} valueClass="text-emerald-600 dark:text-emerald-400" />
      <Stat label="Expense" value={formatMoney(expense, currency)} valueClass="text-red-600 dark:text-red-400" />
      <div className="ml-auto text-right">
        <div className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">Net</div>
        <div className={`text-lg font-semibold tabular-nums ${netColor}`}>
          {net >= 0 ? '+' : '−'}{formatMoney(Math.abs(net), currency)}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, valueClass }: { label: string; value: string; valueClass: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</div>
      <div className={`text-sm font-medium tabular-nums ${valueClass}`}>{value}</div>
    </div>
  );
}
```

- [ ] **Step 3: Create `apps/web/src/components/budget/BudgetInputRow.tsx`**

This is the hero input. Stateful: kind toggle, amount text, category select, date/time, description. Supports both "create new" and "edit existing" modes via the `initial`/`onSave` props.

```tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  BudgetCategory,
  BudgetTransaction,
  CategoryKind,
} from '@pathforge/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { parseMajorToMinor, formatMinorForInput } from '@/lib/budget-formatting';

interface Props {
  categories: BudgetCategory[];
  /** When set, the row is in edit mode for this transaction. */
  initial?: BudgetTransaction;
  /** Called on Add / Save. Returns the body to send. Throw to keep the form open. */
  onSave: (body: {
    amount: number;
    categoryId: string;
    date: Date;
    description?: string;
  }) => Promise<void> | void;
  onCancel?: () => void;
  /** Optional: pre-select a kind when creating. Defaults to 'expense'. */
  defaultKind?: CategoryKind;
  /** Compact mode for the dashboard quick-add modal. */
  compact?: boolean;
}

export function BudgetInputRow({
  categories,
  initial,
  onSave,
  onCancel,
  defaultKind = 'expense',
  compact = false,
}: Props) {
  // Derive the kind for editing from the chosen category.
  const initialCategory = initial
    ? categories.find((c) => c._id === initial.categoryId)
    : undefined;
  const initialKind: CategoryKind = initialCategory?.kind ?? defaultKind;

  const [kind, setKind] = useState<CategoryKind>(initialKind);
  const [amountText, setAmountText] = useState(
    initial ? formatMinorForInput(initial.amount) : ''
  );
  const [categoryId, setCategoryId] = useState<string>(initial?.categoryId ?? '');
  const [date, setDate] = useState<string>(
    initial ? toLocalDateString(new Date(initial.date)) : toLocalDateString(new Date())
  );
  const [time, setTime] = useState<string>(
    initial ? toLocalTimeString(new Date(initial.date)) : toLocalTimeString(new Date())
  );
  const [description, setDescription] = useState<string>(initial?.description ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amountRef = useRef<HTMLInputElement>(null);

  // Refocus amount when kind toggles or after successful save.
  useEffect(() => {
    amountRef.current?.focus();
  }, [kind]);

  // Reset internal state when the editing target changes.
  useEffect(() => {
    if (initial) {
      const cat = categories.find((c) => c._id === initial.categoryId);
      setKind(cat?.kind ?? defaultKind);
      setAmountText(formatMinorForInput(initial.amount));
      setCategoryId(initial.categoryId);
      setDate(toLocalDateString(new Date(initial.date)));
      setTime(toLocalTimeString(new Date(initial.date)));
      setDescription(initial.description ?? '');
    }
  }, [initial, categories, defaultKind]);

  // Live-filtered list for the kind toggle.
  const filteredCategories = useMemo(
    () => categories.filter((c) => !c.archived && c.kind === kind),
    [categories, kind]
  );

  // If the current categoryId is invalid for the active kind, clear it.
  useEffect(() => {
    if (categoryId && !filteredCategories.some((c) => c._id === categoryId)) {
      setCategoryId('');
    }
  }, [categoryId, filteredCategories]);

  async function submit() {
    setError(null);
    const amount = parseMajorToMinor(amountText);
    if (amount === null || amount <= 0) {
      setError('Enter a positive amount');
      return;
    }
    if (!categoryId) {
      setError('Pick a category');
      return;
    }
    const merged = new Date(`${date}T${time}`);
    if (Number.isNaN(merged.getTime())) {
      setError('Invalid date or time');
      return;
    }

    setSubmitting(true);
    try {
      await onSave({
        amount,
        categoryId,
        date: merged,
        description: description.trim() === '' ? undefined : description.trim(),
      });
      if (!initial) {
        // Create mode: clear inputs and refocus.
        setAmountText('');
        setDescription('');
        setCategoryId('');
        amountRef.current?.focus();
      }
    } finally {
      setSubmitting(false);
    }
  }

  function onAmountKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && categoryId) {
      e.preventDefault();
      void submit();
    }
  }

  return (
    <div
      className={`rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 ${compact ? 'p-4' : 'p-5'} space-y-3`}
    >
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <label className="block text-[10px] uppercase tracking-wide text-slate-500 mb-1">
            Amount
          </label>
          <Input
            ref={amountRef}
            value={amountText}
            onChange={(e) => setAmountText(e.target.value)}
            onKeyDown={onAmountKeyDown}
            placeholder="0"
            inputMode="decimal"
            className="text-lg tabular-nums"
          />
        </div>
        <div className="flex gap-1.5 self-end pb-px">
          <Button
            type="button"
            variant={kind === 'income' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setKind('income')}
            className={kind === 'income' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
          >
            + Income
          </Button>
          <Button
            type="button"
            variant={kind === 'expense' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setKind('expense')}
            className={kind === 'expense' ? 'bg-red-600 hover:bg-red-700' : ''}
          >
            − Expense
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] uppercase tracking-wide text-slate-500 mb-1">
            Category
          </label>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger>
              <SelectValue placeholder={filteredCategories.length === 0 ? 'No categories' : 'Pick one'} />
            </SelectTrigger>
            <SelectContent>
              {filteredCategories.map((c) => (
                <SelectItem key={c._id} value={c._id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <div>
            <label className="block text-[10px] uppercase tracking-wide text-slate-500 mb-1">
              Date
            </label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wide text-slate-500 mb-1">
              Time
            </label>
            <Input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-[90px]"
            />
          </div>
        </div>
      </div>

      <div>
        <label className="block text-[10px] uppercase tracking-wide text-slate-500 mb-1">
          Description (optional)
        </label>
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="what / why"
          maxLength={500}
        />
      </div>

      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}

      <div className="flex items-center justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
        )}
        <Button type="button" onClick={submit} disabled={submitting}>
          {initial ? 'Save' : 'Add'}
        </Button>
      </div>
    </div>
  );
}

function toLocalDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function toLocalTimeString(d: Date): string {
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${min}`;
}
```

- [ ] **Step 4: Create `apps/web/src/components/budget/BudgetTransactionRow.tsx`**

```tsx
import { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import type { BudgetTransaction } from '@pathforge/shared';
import { useDeleteBudgetTransaction } from '@/hooks/useBudget';
import { formatMoney } from '@/lib/budget-formatting';

interface Props {
  transaction: BudgetTransaction;
  currency: string;
  onEdit: () => void;
}

export function BudgetTransactionRow({ transaction, currency, onEdit }: Props) {
  const del = useDeleteBudgetTransaction(transaction._id);
  const [confirming, setConfirming] = useState(false);

  const dateLabel = new Date(transaction.date).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <div className="group flex items-start gap-3 px-3 py-2 rounded-md hover:bg-slate-50 dark:hover:bg-slate-900">
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-medium text-slate-900 dark:text-slate-100 tabular-nums">
            {formatMoney(transaction.amount, currency)}
          </span>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            {dateLabel}
          </span>
        </div>
        {transaction.description && (
          <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
            {transaction.description}
          </div>
        )}
      </div>
      <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          type="button"
          onClick={onEdit}
          className="p-1 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
          aria-label="Edit"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        {confirming ? (
          <button
            type="button"
            onClick={() => del.mutate()}
            disabled={del.isPending}
            className="p-1 text-red-600 text-xs font-medium"
            aria-label="Confirm delete"
          >
            Confirm
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            onBlur={() => setConfirming(false)}
            className="p-1 text-slate-500 hover:text-red-600"
            aria-label="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Create `apps/web/src/components/budget/BudgetEditTransactionDialog.tsx`**

```tsx
import type {
  BudgetCategory,
  BudgetTransaction,
} from '@pathforge/shared';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { BudgetInputRow } from './BudgetInputRow';
import { useUpdateBudgetTransaction } from '@/hooks/useBudget';

interface Props {
  transaction: BudgetTransaction | null;
  categories: BudgetCategory[];
  onClose: () => void;
}

export function BudgetEditTransactionDialog({
  transaction,
  categories,
  onClose,
}: Props) {
  const update = useUpdateBudgetTransaction(transaction?._id ?? '');

  if (!transaction) return null;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Edit transaction</DialogTitle>
        </DialogHeader>
        <BudgetInputRow
          categories={categories}
          initial={transaction}
          compact
          onSave={async (body) => {
            await update.mutateAsync({
              amount: body.amount,
              categoryId: body.categoryId,
              date: body.date,
              description: body.description ?? null,
            });
            onClose();
          }}
          onCancel={onClose}
        />
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 6: Create `apps/web/src/components/budget/BudgetLogColumn.tsx`**

```tsx
import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type {
  BudgetCategory,
  BudgetCategoryGroup,
  BudgetTransaction,
  CategoryKind,
} from '@pathforge/shared';
import { BudgetTransactionRow } from './BudgetTransactionRow';
import { formatMoney } from '@/lib/budget-formatting';

interface Props {
  kind: CategoryKind;
  groups: BudgetCategoryGroup[];
  categories: BudgetCategory[];
  transactions: BudgetTransaction[];
  currency: string;
  onEditTransaction: (txn: BudgetTransaction) => void;
}

/**
 * Income or expense column. Renders only groups that have at least one
 * category of the matching kind AND at least one transaction in the month
 * for those categories.
 */
export function BudgetLogColumn({
  kind,
  groups,
  categories,
  transactions,
  currency,
  onEditTransaction,
}: Props) {
  const accent =
    kind === 'income'
      ? 'text-emerald-700 dark:text-emerald-400'
      : 'text-red-700 dark:text-red-400';

  // Filter to categories of this kind (incl. archived — historical txns).
  const inKind = useMemo(
    () => categories.filter((c) => c.kind === kind),
    [categories, kind]
  );
  const categoriesById = useMemo(
    () => new Map(inKind.map((c) => [c._id, c])),
    [inKind]
  );

  // Bucket transactions by category, only those of this kind.
  const byCategory = useMemo(() => {
    const map = new Map<string, BudgetTransaction[]>();
    for (const t of transactions) {
      if (!categoriesById.has(t.categoryId)) continue;
      const arr = map.get(t.categoryId) ?? [];
      arr.push(t);
      map.set(t.categoryId, arr);
    }
    // Sort each category's transactions newest-first.
    for (const arr of map.values()) {
      arr.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }
    return map;
  }, [transactions, categoriesById]);

  const total = useMemo(
    () =>
      Array.from(byCategory.values()).flat().reduce((s, t) => s + t.amount, 0),
    [byCategory]
  );

  // Group ordering: same as the groups prop. Within each group, categories
  // ordered by the category list's order field. Only groups with at least
  // one transaction-bearing category in this kind are rendered.
  const groupedRows = useMemo(() => {
    const sortedCats = [...inKind].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    return groups.map((g) => {
      const cats = sortedCats.filter(
        (c) => c.groupId === g._id && (byCategory.get(c._id)?.length ?? 0) > 0
      );
      return { group: g, cats };
    }).filter((row) => row.cats.length > 0);
  }, [groups, inKind, byCategory]);

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-5">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className={`text-sm font-semibold uppercase tracking-wide ${accent}`}>
          {kind === 'income' ? 'Incomes' : 'Expenses'}
        </h2>
        <div className={`text-base font-semibold tabular-nums ${accent}`}>
          {formatMoney(total, currency)}
        </div>
      </div>
      {groupedRows.length === 0 ? (
        <div className="text-sm text-slate-500 dark:text-slate-400 py-4">
          {kind === 'income' ? 'No incomes this month.' : 'No expenses this month.'}
        </div>
      ) : (
        <div className="space-y-3">
          {groupedRows.map(({ group, cats }) => (
            <GroupBlock
              key={group._id}
              group={group}
              cats={cats}
              byCategory={byCategory}
              currency={currency}
              onEditTransaction={onEditTransaction}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface GroupBlockProps {
  group: BudgetCategoryGroup;
  cats: BudgetCategory[];
  byCategory: Map<string, BudgetTransaction[]>;
  currency: string;
  onEditTransaction: (txn: BudgetTransaction) => void;
}

function GroupBlock({
  group,
  cats,
  byCategory,
  currency,
  onEditTransaction,
}: GroupBlockProps) {
  const [open, setOpen] = useState(true);
  const groupTotal = cats.reduce(
    (s, c) => s + (byCategory.get(c._id)?.reduce((ss, t) => ss + t.amount, 0) ?? 0),
    0
  );

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100"
      >
        {open ? (
          <ChevronDown className="h-3.5 w-3.5" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5" />
        )}
        <span
          className="h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: group.color }}
        />
        <span>{group.name}</span>
        <span className="ml-auto text-slate-500 tabular-nums">
          {formatMoney(groupTotal, currency)}
        </span>
      </button>
      {open && (
        <div className="mt-1.5 ml-5 space-y-2">
          {cats.map((c) => (
            <CategoryBlock
              key={c._id}
              category={c}
              transactions={byCategory.get(c._id) ?? []}
              currency={currency}
              onEditTransaction={onEditTransaction}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface CategoryBlockProps {
  category: BudgetCategory;
  transactions: BudgetTransaction[];
  currency: string;
  onEditTransaction: (txn: BudgetTransaction) => void;
}

function CategoryBlock({
  category,
  transactions,
  currency,
  onEditTransaction,
}: CategoryBlockProps) {
  const subtotal = transactions.reduce((s, t) => s + t.amount, 0);
  return (
    <div>
      <div className="flex items-baseline justify-between mb-0.5 px-1">
        <span className="text-xs font-medium text-slate-800 dark:text-slate-200">
          {category.name}{category.archived ? ' (archived)' : ''}
        </span>
        <span className="text-xs text-slate-500 tabular-nums">
          {formatMoney(subtotal, currency)}
        </span>
      </div>
      <div className="space-y-0.5">
        {transactions.map((t) => (
          <BudgetTransactionRow
            key={t._id}
            transaction={t}
            currency={currency}
            onEdit={() => onEditTransaction(t)}
          />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Wire everything in `apps/web/src/pages/BudgetPage.tsx`**

Replace the page contents:

```tsx
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { BudgetTabStrip } from '@/components/budget/BudgetTabStrip';
import { BudgetMonthSelector } from '@/components/budget/BudgetMonthSelector';
import { BudgetInputRow } from '@/components/budget/BudgetInputRow';
import { BudgetNetBand } from '@/components/budget/BudgetNetBand';
import { BudgetLogColumn } from '@/components/budget/BudgetLogColumn';
import { BudgetEditTransactionDialog } from '@/components/budget/BudgetEditTransactionDialog';
import {
  useBudgetCategories,
  useBudgetGroups,
  useBudgetTransactions,
  useCreateBudgetTransaction,
} from '@/hooks/useBudget';
import { useMe } from '@/hooks/useAuth';
import { currentIsoMonth, toIsoMonth } from '@/lib/budget-month';
import type { BudgetTransaction } from '@pathforge/shared';

export default function BudgetPage() {
  const [month, setMonth] = useState<string>(currentIsoMonth());
  const [editing, setEditing] = useState<BudgetTransaction | null>(null);
  const { data: me } = useMe();
  const currency = me?.currency ?? 'INR';

  const { data: groups = [] } = useBudgetGroups();
  const { data: categories = [] } = useBudgetCategories();
  const { data: transactions = [], isPending } = useBudgetTransactions(month);
  const create = useCreateBudgetTransaction();

  const liveGroups = useMemo(() => groups.filter((g) => !g.archived), [groups]);

  const { income, expense } = useMemo(() => {
    let inc = 0;
    let exp = 0;
    const categoriesById = new Map(categories.map((c) => [c._id, c]));
    for (const t of transactions) {
      const cat = categoriesById.get(t.categoryId);
      if (!cat) continue;
      if (cat.kind === 'income') inc += t.amount;
      else exp += t.amount;
    }
    return { income: inc, expense: exp };
  }, [transactions, categories]);
  const net = income - expense;

  async function handleAdd(body: {
    amount: number;
    categoryId: string;
    date: Date;
    description?: string;
  }) {
    const created = await create.mutateAsync(body);
    const createdMonth = toIsoMonth(new Date(created.date));
    if (createdMonth !== month) {
      // The user backdated/future-dated into a different month. Surface
      // a toast offering to navigate, but don't auto-switch (the row clearing
      // in the input row already implied the action succeeded).
      toast.info(
        `Added to ${createdMonth} — switch?`,
        {
          action: {
            label: 'Switch',
            onClick: () => setMonth(createdMonth),
          },
        }
      );
    }
  }

  return (
    <main className="container py-10">
      <h1 className="text-2xl font-semibold tracking-tight mb-6">Budget</h1>
      <BudgetTabStrip />

      <div className="flex items-center justify-between mb-4">
        <BudgetMonthSelector month={month} onChange={setMonth} />
      </div>

      <div className="space-y-4 mb-6">
        <BudgetInputRow
          categories={categories}
          onSave={handleAdd}
        />
        <BudgetNetBand income={income} expense={expense} net={net} currency={currency} />
      </div>

      {isPending ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <BudgetLogColumn
            kind="income"
            groups={liveGroups}
            categories={categories}
            transactions={transactions}
            currency={currency}
            onEditTransaction={setEditing}
          />
          <BudgetLogColumn
            kind="expense"
            groups={liveGroups}
            categories={categories}
            transactions={transactions}
            currency={currency}
            onEditTransaction={setEditing}
          />
        </div>
      )}

      <BudgetEditTransactionDialog
        transaction={editing}
        categories={categories}
        onClose={() => setEditing(null)}
      />
    </main>
  );
}
```

- [ ] **Step 8: Manual smoke**

Start dev server, navigate to `/budget`. Verify:
- Month selector navigates between months; month label updates.
- Input row: type an amount, click Income/Expense — category dropdown updates accordingly. Submit a transaction; the row clears and reappears in the appropriate column.
- Net band updates after each add.
- Transactions group under their category, then category-group, with collapsible groups.
- Hover a transaction → edit/delete icons appear; clicking edit opens the dialog; saving the edit updates the row.
- Backdate to last month → toast appears with "Switch?" action.

- [ ] **Step 9: Typecheck**

Run: `npx tsc --noEmit -p apps/web/tsconfig.json`
Expected: no errors.

- [ ] **Step 10: Commit**

```bash
git add apps/web/src/components/budget/BudgetMonthSelector.tsx apps/web/src/components/budget/BudgetNetBand.tsx apps/web/src/components/budget/BudgetInputRow.tsx apps/web/src/components/budget/BudgetTransactionRow.tsx apps/web/src/components/budget/BudgetEditTransactionDialog.tsx apps/web/src/components/budget/BudgetLogColumn.tsx apps/web/src/pages/BudgetPage.tsx
git commit -m "$(cat <<'EOF'
feat(web): build /budget main page with input row + two-column log

Hero input row with amount + Income/Expense toggle + category select +
date/time + description; net band showing the month at a glance;
two-column log (green incomes left, red expenses right) grouped by
category-group → category → transaction. Edit dialog reuses the input
row component. Backdating to a different month surfaces a toast with
a Switch action.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6 — Plan page (monthly targets)

**Files:**
- Create: `apps/web/src/components/budget/BudgetTargetsForm.tsx`
- Modify: `apps/web/src/pages/BudgetPlanPage.tsx`

- [ ] **Step 1: Create `apps/web/src/components/budget/BudgetTargetsForm.tsx`**

```tsx
import { useEffect, useMemo, useState } from 'react';
import type {
  BudgetCategoryGroup,
  BudgetCategory,
  BudgetTarget,
} from '@pathforge/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  useBudgetTargets,
  useBulkUpsertTargets,
} from '@/hooks/useBudget';
import { addMonths } from '@/lib/budget-month';
import {
  parseMajorToMinor,
  formatMinorForInput,
} from '@/lib/budget-formatting';

interface Props {
  month: string;
  groups: BudgetCategoryGroup[];
  categories: BudgetCategory[];
  currency: string;
}

/**
 * Map of categoryId → string the user has typed (major units). Stored as
 * strings so partial edits ("12" while typing "1200") don't get coerced
 * back to numbers mid-keypress.
 */
type DraftMap = Record<string, string>;

export function BudgetTargetsForm({ month, groups, categories, currency }: Props) {
  const { data: targets = [], isPending } = useBudgetTargets(month);
  const { data: prevTargets = [] } = useBudgetTargets(addMonths(month, -1));
  const upsert = useBulkUpsertTargets();

  const targetsByCategory = useMemo(() => {
    const map = new Map<string, BudgetTarget>();
    for (const t of targets) map.set(t.categoryId, t);
    return map;
  }, [targets]);

  const prevByCategory = useMemo(() => {
    const map = new Map<string, BudgetTarget>();
    for (const t of prevTargets) map.set(t.categoryId, t);
    return map;
  }, [prevTargets]);

  // Live categories grouped by group.
  const liveCategories = useMemo(
    () => categories.filter((c) => !c.archived),
    [categories]
  );

  const [draft, setDraft] = useState<DraftMap>({});
  const [bannerKind, setBannerKind] =
    useState<'pre-filled' | 'first-ever' | 'none'>('none');

  // Initialize draft when targets data arrives or month changes.
  useEffect(() => {
    if (isPending) return;
    const next: DraftMap = {};
    if (targetsByCategory.size > 0) {
      // Existing targets — fill from them; banner off.
      for (const c of liveCategories) {
        const existing = targetsByCategory.get(c._id);
        next[c._id] = existing ? formatMinorForInput(existing.amount) : '';
      }
      setBannerKind('none');
    } else if (prevByCategory.size > 0) {
      // Carry-forward from previous month.
      for (const c of liveCategories) {
        const prev = prevByCategory.get(c._id);
        next[c._id] = prev ? formatMinorForInput(prev.amount) : '';
      }
      setBannerKind('pre-filled');
    } else {
      // First-ever use.
      for (const c of liveCategories) {
        next[c._id] = '';
      }
      setBannerKind('first-ever');
    }
    setDraft(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, isPending, targetsByCategory, prevByCategory, liveCategories.length]);

  const dirty = useMemo(() => {
    // Dirty if any draft amount differs from the persisted target for that
    // category. Empty string is treated as "no target" — dirty only if there
    // was a target before.
    for (const c of liveCategories) {
      const d = draft[c._id] ?? '';
      const existing = targetsByCategory.get(c._id);
      if (d.trim() === '') {
        if (existing) return true;
        continue;
      }
      const minor = parseMajorToMinor(d);
      if (minor === null) return true;
      if (!existing || existing.amount !== minor) return true;
    }
    return false;
  }, [draft, liveCategories, targetsByCategory]);

  async function onSave() {
    const items: Array<{ categoryId: string; amount: number }> = [];
    for (const c of liveCategories) {
      const d = draft[c._id] ?? '';
      if (d.trim() === '') continue;
      const minor = parseMajorToMinor(d);
      if (minor === null) continue;
      items.push({ categoryId: c._id, amount: minor });
    }
    await upsert.mutateAsync({ month, items });
  }

  if (isPending) {
    return <p className="text-sm text-slate-500">Loading…</p>;
  }

  return (
    <div className="space-y-4">
      {bannerKind === 'pre-filled' && (
        <div className="rounded-md border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
          These are last month's numbers — confirm or adjust, then Save.
        </div>
      )}
      {bannerKind === 'first-ever' && (
        <div className="rounded-md border border-sky-200 dark:border-sky-900 bg-sky-50 dark:bg-sky-950/40 px-4 py-3 text-sm text-sky-900 dark:text-sky-200">
          Set your first monthly targets — they're soft anchors, not hard limits.
        </div>
      )}

      <div className="space-y-4">
        {groups.map((g) => {
          const inGroup = liveCategories
            .filter((c) => c.groupId === g._id)
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
          if (inGroup.length === 0) return null;
          return (
            <div
              key={g._id}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-4"
            >
              <div className="flex items-center gap-2 mb-3">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: g.color }}
                />
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {g.name}
                </h3>
              </div>
              <div className="space-y-2">
                {inGroup.map((c) => (
                  <div key={c._id} className="flex items-center gap-3">
                    <span className="flex-1 text-sm text-slate-800 dark:text-slate-200">
                      {c.name}
                    </span>
                    <div className="flex items-center gap-1.5 w-44">
                      <span className="text-xs text-slate-500">{currencySymbol(currency)}</span>
                      <Input
                        value={draft[c._id] ?? ''}
                        onChange={(e) =>
                          setDraft((d) => ({ ...d, [c._id]: e.target.value }))
                        }
                        placeholder="0"
                        inputMode="decimal"
                        className="text-right tabular-nums"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-end">
        <Button onClick={onSave} disabled={!dirty || upsert.isPending}>
          {upsert.isPending ? 'Saving…' : 'Save targets'}
        </Button>
      </div>
    </div>
  );
}

const SYMBOLS: Record<string, string> = {
  INR: '₹', USD: '$', EUR: '€', GBP: '£', AUD: 'A$', CAD: 'C$', SGD: 'S$', JPY: '¥',
};
function currencySymbol(code: string): string {
  return SYMBOLS[code] ?? code;
}
```

- [ ] **Step 2: Wire `apps/web/src/pages/BudgetPlanPage.tsx`**

```tsx
import { useState } from 'react';
import { BudgetTabStrip } from '@/components/budget/BudgetTabStrip';
import { BudgetMonthSelector } from '@/components/budget/BudgetMonthSelector';
import { BudgetTargetsForm } from '@/components/budget/BudgetTargetsForm';
import { useBudgetGroups, useBudgetCategories } from '@/hooks/useBudget';
import { useMe } from '@/hooks/useAuth';
import { currentIsoMonth } from '@/lib/budget-month';

export default function BudgetPlanPage() {
  const [month, setMonth] = useState<string>(currentIsoMonth());
  const { data: groups = [] } = useBudgetGroups();
  const { data: categories = [] } = useBudgetCategories();
  const { data: me } = useMe();
  const currency = me?.currency ?? 'INR';

  const liveGroups = groups.filter((g) => !g.archived);

  return (
    <main className="container py-10">
      <h1 className="text-2xl font-semibold tracking-tight mb-6">Budget</h1>
      <BudgetTabStrip />
      <div className="flex items-center justify-between mb-4">
        <BudgetMonthSelector month={month} onChange={setMonth} />
      </div>
      <BudgetTargetsForm
        month={month}
        groups={liveGroups}
        categories={categories}
        currency={currency}
      />
    </main>
  );
}
```

- [ ] **Step 3: Manual smoke**

Navigate to `/budget/plan`. Verify:
- Fresh month with no prior targets shows the "Set your first monthly targets" banner.
- Type a value into a category target field; Save commits.
- Navigate to next month with no targets but prior month has them → "These are last month's numbers" banner with the prior numbers pre-filled (as draft, not persisted yet).
- Save persists; revisiting that month shows the values without the banner.
- Clearing a field and saving removes the target.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit -p apps/web/tsconfig.json`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/budget/BudgetTargetsForm.tsx apps/web/src/pages/BudgetPlanPage.tsx
git commit -m "$(cat <<'EOF'
feat(web): build /budget/plan page with monthly targets form

Grouped list of live categories with target-amount inputs per month.
Drafts persist until Save. Carry-forward: when a fresh month has no
targets, last month's numbers pre-fill as a draft with an amber banner;
first-ever use shows a sky banner. Empty input clears the target on
save.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7 — Recurring templates page

**Files:**
- Create: `apps/web/src/components/budget/BudgetRecurringFormDialog.tsx`
- Create: `apps/web/src/components/budget/BudgetRecurringList.tsx`
- Modify: `apps/web/src/pages/BudgetRecurringPage.tsx`

- [ ] **Step 1: Create `apps/web/src/components/budget/BudgetRecurringFormDialog.tsx`**

```tsx
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type {
  BudgetCategory,
  BudgetRecurringTemplate,
} from '@pathforge/shared';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useCreateBudgetRecurring,
  useUpdateBudgetRecurring,
} from '@/hooks/useBudget';
import {
  parseMajorToMinor,
  formatMinorForInput,
} from '@/lib/budget-formatting';

const Schema = z.object({
  label: z.string().min(1, 'Required').max(120),
  categoryId: z.string().min(1, 'Pick a category'),
  amountText: z.string().min(1, 'Required'),
  dayOfMonth: z.coerce.number().int().min(1).max(28),
  active: z.boolean(),
});
type FormValues = z.infer<typeof Schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: BudgetCategory[];
  template?: BudgetRecurringTemplate;
}

export function BudgetRecurringFormDialog({
  open,
  onOpenChange,
  categories,
  template,
}: Props) {
  const create = useCreateBudgetRecurring();
  const update = useUpdateBudgetRecurring(template?._id ?? '');

  const form = useForm<FormValues>({
    resolver: zodResolver(Schema),
    defaultValues: {
      label: template?.label ?? '',
      categoryId: template?.categoryId ?? categories[0]?._id ?? '',
      amountText: template ? formatMinorForInput(template.amount) : '',
      dayOfMonth: template?.dayOfMonth ?? 1,
      active: template?.active ?? true,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        label: template?.label ?? '',
        categoryId: template?.categoryId ?? categories[0]?._id ?? '',
        amountText: template ? formatMinorForInput(template.amount) : '',
        dayOfMonth: template?.dayOfMonth ?? 1,
        active: template?.active ?? true,
      });
    }
  }, [open, template, categories, form]);

  const submitting = create.isPending || update.isPending;

  async function onSubmit(values: FormValues) {
    const amount = parseMajorToMinor(values.amountText);
    if (amount === null || amount <= 0) {
      form.setError('amountText', { message: 'Enter a positive amount' });
      return;
    }
    const body = {
      label: values.label,
      categoryId: values.categoryId,
      amount,
      dayOfMonth: values.dayOfMonth,
      active: values.active,
    };
    if (template) {
      await update.mutateAsync(body);
    } else {
      await create.mutateAsync({ ...body, cadence: 'monthly' });
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{template ? 'Edit template' : 'New recurring template'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Label</label>
            <Input {...form.register('label')} placeholder="Rent, Salary, Spotify…" autoFocus />
            {form.formState.errors.label && (
              <p className="text-xs text-red-600">{form.formState.errors.label.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Category</label>
            <Select
              value={form.watch('categoryId')}
              onValueChange={(v) => form.setValue('categoryId', v, { shouldValidate: true })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.filter((c) => !c.archived).map((c) => (
                  <SelectItem key={c._id} value={c._id}>
                    {c.name} ({c.kind})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Amount</label>
              <Input {...form.register('amountText')} placeholder="0" inputMode="decimal" />
              {form.formState.errors.amountText && (
                <p className="text-xs text-red-600">{form.formState.errors.amountText.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Day of month (1–28)</label>
              <Input
                type="number"
                min={1}
                max={28}
                {...form.register('dayOfMonth', { valueAsNumber: true })}
              />
              {form.formState.errors.dayOfMonth && (
                <p className="text-xs text-red-600">{form.formState.errors.dayOfMonth.message}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              id="active"
              type="checkbox"
              checked={form.watch('active')}
              onChange={(e) => form.setValue('active', e.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            <label htmlFor="active" className="text-sm text-slate-700 dark:text-slate-300">
              Active (eligible for Apply each month)
            </label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {template ? 'Save' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Create `apps/web/src/components/budget/BudgetRecurringList.tsx`**

```tsx
import { useState } from 'react';
import { Pencil, Trash2, Play } from 'lucide-react';
import type {
  BudgetRecurringTemplate,
  BudgetCategory,
} from '@pathforge/shared';
import { Button } from '@/components/ui/button';
import {
  useApplyBudgetRecurring,
  useDeleteBudgetRecurring,
} from '@/hooks/useBudget';
import { formatMoney } from '@/lib/budget-formatting';
import { currentIsoMonth } from '@/lib/budget-month';
import { BudgetRecurringFormDialog } from './BudgetRecurringFormDialog';

interface Props {
  templates: BudgetRecurringTemplate[];
  categories: BudgetCategory[];
  currency: string;
}

export function BudgetRecurringList({ templates, categories, currency }: Props) {
  const [editing, setEditing] = useState<BudgetRecurringTemplate | undefined>();
  const month = currentIsoMonth();

  const categoriesById = new Map(categories.map((c) => [c._id, c]));

  if (templates.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-8 text-center">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-1">
          No recurring templates yet
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Create one for things that repeat monthly — rent, salary, subscriptions.
          They never auto-create transactions; you click Apply each month.
        </p>
      </div>
    );
  }

  return (
    <>
      <ul className="space-y-2">
        {templates.map((t) => (
          <Row
            key={t._id}
            template={t}
            category={categoriesById.get(t.categoryId) ?? null}
            currency={currency}
            currentMonth={month}
            onEdit={() => setEditing(t)}
          />
        ))}
      </ul>
      <BudgetRecurringFormDialog
        open={!!editing}
        onOpenChange={(open) => !open && setEditing(undefined)}
        categories={categories}
        template={editing}
      />
    </>
  );
}

interface RowProps {
  template: BudgetRecurringTemplate;
  category: BudgetCategory | null;
  currency: string;
  currentMonth: string;
  onEdit: () => void;
}

function Row({ template, category, currency, currentMonth, onEdit }: RowProps) {
  const apply = useApplyBudgetRecurring(template._id);
  const del = useDeleteBudgetRecurring(template._id);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const dueThisMonth = template.active && template.lastRunMonth !== currentMonth;
  const appliedThisMonth = template.lastRunMonth === currentMonth;

  return (
    <li className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-4 flex items-center gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {template.label}
          </span>
          {!template.active && (
            <span className="text-[10px] uppercase tracking-wide text-slate-500 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
              Inactive
            </span>
          )}
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          {category?.name ?? 'Unknown category'} · day {template.dayOfMonth} · {formatMoney(template.amount, currency)}
          {appliedThisMonth && ' · applied this month'}
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Button
          size="sm"
          variant={dueThisMonth ? 'default' : 'outline'}
          disabled={!dueThisMonth || apply.isPending}
          onClick={() => apply.mutate()}
        >
          <Play className="h-3.5 w-3.5 mr-1" /> Apply
        </Button>
        <Button size="icon" variant="ghost" onClick={onEdit} aria-label="Edit">
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        {confirmingDelete ? (
          <Button
            size="sm"
            variant="destructive"
            onClick={() => del.mutate()}
            disabled={del.isPending}
            onBlur={() => setConfirmingDelete(false)}
          >
            Confirm
          </Button>
        ) : (
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setConfirmingDelete(true)}
            aria-label="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </li>
  );
}
```

- [ ] **Step 3: Wire `apps/web/src/pages/BudgetRecurringPage.tsx`**

```tsx
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { BudgetTabStrip } from '@/components/budget/BudgetTabStrip';
import { BudgetRecurringList } from '@/components/budget/BudgetRecurringList';
import { BudgetRecurringFormDialog } from '@/components/budget/BudgetRecurringFormDialog';
import { Button } from '@/components/ui/button';
import {
  useBudgetCategories,
  useBudgetRecurring,
} from '@/hooks/useBudget';
import { useMe } from '@/hooks/useAuth';

export default function BudgetRecurringPage() {
  const { data: templates = [], isPending } = useBudgetRecurring();
  const { data: categories = [] } = useBudgetCategories();
  const { data: me } = useMe();
  const currency = me?.currency ?? 'INR';
  const [newOpen, setNewOpen] = useState(false);

  return (
    <main className="container py-10">
      <h1 className="text-2xl font-semibold tracking-tight mb-6">Budget</h1>
      <BudgetTabStrip />

      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Templates for monthly repeats. They never auto-create transactions —
          you Apply them each month.
        </p>
        <Button onClick={() => setNewOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> New template
        </Button>
      </div>

      {isPending ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <BudgetRecurringList
          templates={templates}
          categories={categories}
          currency={currency}
        />
      )}

      <BudgetRecurringFormDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        categories={categories}
      />
    </main>
  );
}
```

- [ ] **Step 4: Manual smoke**

Navigate to `/budget/recurring`. Verify:
- Empty state shows when no templates exist.
- Create a template → appears in list with an enabled "Apply" button (current month not yet applied).
- Click Apply → toast no error; the template now shows "applied this month" and Apply is disabled.
- A second Apply in the same month surfaces a 409 toast.
- Edit dialog prefills the existing template; saving updates it.
- Delete → click once to confirm, click "Confirm" to actually delete.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit -p apps/web/tsconfig.json`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/budget/BudgetRecurringFormDialog.tsx apps/web/src/components/budget/BudgetRecurringList.tsx apps/web/src/pages/BudgetRecurringPage.tsx
git commit -m "$(cat <<'EOF'
feat(web): build /budget/recurring page with templates + apply

Lists recurring monthly templates with their cadence, category, amount,
and day-of-month. Apply button is enabled only when active && not yet
applied this month; second-apply surfaces the server's 409 via the
toast helper. Create/edit dialog reuses the same shape; delete is a
two-click confirm.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8 — Report page (monthly retrospective)

**Files:**
- Create: `apps/web/src/components/budget/BudgetReportNarrative.tsx`
- Create: `apps/web/src/components/budget/BudgetReportGroups.tsx`
- Modify: `apps/web/src/pages/BudgetReportPage.tsx`

- [ ] **Step 1: Create `apps/web/src/components/budget/BudgetReportNarrative.tsx`**

```tsx
import type { BudgetReport } from '@pathforge/shared';
import { formatMoney } from '@/lib/budget-formatting';

interface Props {
  report: BudgetReport;
}

export function BudgetReportNarrative({ report }: Props) {
  const { totals, targetTotals, currency, narrative } = report;
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-6 space-y-3">
      <p className="text-base text-slate-900 dark:text-slate-100 leading-relaxed">
        {narrative}
      </p>
      <div className="flex gap-6 text-sm">
        <Headline label="Income" amount={totals.income} target={targetTotals.income} currency={currency} positive />
        <Headline label="Expense" amount={totals.expense} target={targetTotals.expense} currency={currency} />
        <div>
          <div className="text-[10px] uppercase tracking-wide text-slate-500">Net</div>
          <div
            className={`text-base font-semibold tabular-nums ${
              totals.net >= 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-red-600 dark:text-red-400'
            }`}
          >
            {totals.net >= 0 ? '+' : '−'}{formatMoney(Math.abs(totals.net), currency)}
          </div>
        </div>
      </div>
    </div>
  );
}

function Headline({
  label,
  amount,
  target,
  currency,
  positive = false,
}: {
  label: string;
  amount: number;
  target: number;
  currency: string;
  positive?: boolean;
}) {
  const color = positive
    ? 'text-emerald-600 dark:text-emerald-400'
    : 'text-red-600 dark:text-red-400';
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`text-base font-semibold tabular-nums ${color}`}>
        {formatMoney(amount, currency)}
      </div>
      {target > 0 && (
        <div className="text-[11px] text-slate-500">of {formatMoney(target, currency)}</div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create `apps/web/src/components/budget/BudgetReportGroups.tsx`**

```tsx
import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { BudgetReport, BudgetReportGroupRow } from '@pathforge/shared';
import { formatMoney } from '@/lib/budget-formatting';

interface Props {
  report: BudgetReport;
}

export function BudgetReportGroups({ report }: Props) {
  // Render expense groups first (most users care more), then income.
  const expense = report.groups.filter((g) => g.kind === 'expense');
  const income = report.groups.filter((g) => g.kind === 'income');

  return (
    <div className="space-y-6">
      {expense.length > 0 && (
        <Section title="Expenses" rows={expense} currency={report.currency} />
      )}
      {income.length > 0 && (
        <Section title="Incomes" rows={income} currency={report.currency} />
      )}
    </div>
  );
}

function Section({
  title,
  rows,
  currency,
}: {
  title: string;
  rows: BudgetReportGroupRow[];
  currency: string;
}) {
  return (
    <section>
      <h2 className="text-xs uppercase tracking-wide text-slate-500 mb-2">{title}</h2>
      <div className="space-y-2">
        {rows.map((g) => (
          <GroupRow key={g.groupId} group={g} currency={currency} />
        ))}
      </div>
    </section>
  );
}

function GroupRow({
  group,
  currency,
}: {
  group: BudgetReportGroupRow;
  currency: string;
}) {
  const [open, setOpen] = useState(true);
  const overTarget = group.target > 0 && group.actual > group.target;
  const underTarget = group.target > 0 && group.actual < group.target;
  const pct = group.target > 0 ? Math.min(100, Math.round((group.actual / group.target) * 100)) : 0;

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-900 text-left"
      >
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
        )}
        <span className="flex-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
          {group.name}
        </span>
        <span className="text-sm tabular-nums text-slate-700 dark:text-slate-300">
          {formatMoney(group.actual, currency)}
        </span>
        {group.target > 0 && (
          <span className="text-xs tabular-nums text-slate-500">
            / {formatMoney(group.target, currency)}
          </span>
        )}
        {overTarget && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300">
            over
          </span>
        )}
        {underTarget && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
            under
          </span>
        )}
      </button>
      {group.target > 0 && (
        <div className="px-4 pb-2">
          <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div
              className={`h-full ${overTarget ? 'bg-red-500' : 'bg-emerald-500'}`}
              style={{ width: `${Math.min(100, pct)}%` }}
            />
          </div>
        </div>
      )}
      {open && group.categories.length > 0 && (
        <div className="border-t border-slate-100 dark:border-slate-800 px-4 py-3 space-y-2">
          {group.categories.map((c) => {
            const cOverTarget = c.target > 0 && c.actual > c.target;
            const cUnderTarget = c.target > 0 && c.actual < c.target;
            const cPct = c.target > 0 ? Math.min(100, Math.round((c.actual / c.target) * 100)) : 0;
            return (
              <div key={c.categoryId} className="space-y-1">
                <div className="flex items-baseline gap-2">
                  <span className="flex-1 text-sm text-slate-800 dark:text-slate-200">
                    {c.name}
                  </span>
                  <span className="text-sm tabular-nums text-slate-900 dark:text-slate-100">
                    {formatMoney(c.actual, currency)}
                  </span>
                  {c.target > 0 && (
                    <span className="text-xs tabular-nums text-slate-500">
                      / {formatMoney(c.target, currency)}
                    </span>
                  )}
                  {cOverTarget && <span className="h-1.5 w-1.5 rounded-full bg-red-500" />}
                  {cUnderTarget && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />}
                </div>
                {c.target > 0 && (
                  <div className="h-1 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full ${cOverTarget ? 'bg-red-500' : 'bg-emerald-500'}`}
                      style={{ width: `${Math.min(100, cPct)}%` }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Wire `apps/web/src/pages/BudgetReportPage.tsx`**

```tsx
import { useState } from 'react';
import { BudgetTabStrip } from '@/components/budget/BudgetTabStrip';
import { BudgetMonthSelector } from '@/components/budget/BudgetMonthSelector';
import { BudgetReportNarrative } from '@/components/budget/BudgetReportNarrative';
import { BudgetReportGroups } from '@/components/budget/BudgetReportGroups';
import { useBudgetReport } from '@/hooks/useBudget';
import { currentIsoMonth } from '@/lib/budget-month';

export default function BudgetReportPage() {
  const [month, setMonth] = useState<string>(currentIsoMonth());
  const { data: report, isPending } = useBudgetReport(month);

  return (
    <main className="container py-10">
      <h1 className="text-2xl font-semibold tracking-tight mb-6">Budget</h1>
      <BudgetTabStrip />
      <div className="flex items-center justify-between mb-4">
        <BudgetMonthSelector month={month} onChange={setMonth} />
      </div>
      {isPending || !report ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <div className="space-y-6">
          <BudgetReportNarrative report={report} />
          <BudgetReportGroups report={report} />
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 4: Manual smoke**

Navigate to `/budget/report`. Verify:
- Current month shows a narrative line, headline numbers, and per-group + per-category rollups.
- Categories with no target show only the actual figure (no progress bar).
- Categories that overshot get a red marker + red bar; undershot get emerald.
- Navigate to an empty month → narrative reads "no transactions were logged".
- Set a target on /budget/plan, add a transaction over the target, refresh the report → "over" marker appears.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit -p apps/web/tsconfig.json`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/budget/BudgetReportNarrative.tsx apps/web/src/components/budget/BudgetReportGroups.tsx apps/web/src/pages/BudgetReportPage.tsx
git commit -m "$(cat <<'EOF'
feat(web): build /budget/report page (monthly retrospective)

Narrative banner from the server's template-generated string, headline
income/expense/net numbers, then per-group rollups with target-vs-actual
progress bars and over/under markers. Categories without a target only
show actuals.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9 — Dashboard widget

**Files:**
- Create: `apps/web/src/components/dashboard/BudgetWidget.tsx`
- Modify: `apps/web/src/pages/Dashboard.tsx`

- [ ] **Step 1: [Read first] Match the existing widget pattern**

Re-read `apps/web/src/components/dashboard/JobsWidget.tsx` and `RoadmapsWidget.tsx`. The new widget mirrors the same shape: `Header` / body / `Footer`, skeleton loading state, error state, empty state.

- [ ] **Step 2: Create `apps/web/src/components/dashboard/BudgetWidget.tsx`**

```tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wallet } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { BudgetInputRow } from '@/components/budget/BudgetInputRow';
import {
  useBudgetCategories,
  useBudgetReport,
  useCreateBudgetTransaction,
} from '@/hooks/useBudget';
import { formatMoney } from '@/lib/budget-formatting';
import { currentIsoMonth, formatMonthLabel } from '@/lib/budget-month';

export function BudgetWidget() {
  const navigate = useNavigate();
  const month = currentIsoMonth();
  const { data: report, isLoading, isError } = useBudgetReport(month);
  const { data: categories = [] } = useBudgetCategories();
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const create = useCreateBudgetTransaction();

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-6">
      <Header month={month} />
      <div className="mt-3 min-h-[110px]">
        {isLoading ? (
          <Skeleton />
        ) : isError || !report ? (
          <div className="text-xs text-slate-400">Couldn't load.</div>
        ) : report.totals.income === 0 && report.totals.expense === 0 ? (
          <EmptyState onOpen={() => navigate('/budget')} />
        ) : (
          <Body report={report} />
        )}
      </div>
      <Footer
        onAdd={() => setQuickAddOpen(true)}
        onOpen={() => navigate('/budget')}
      />
      <Dialog open={quickAddOpen} onOpenChange={setQuickAddOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Quick add — {formatMonthLabel(month)}</DialogTitle>
          </DialogHeader>
          <BudgetInputRow
            categories={categories}
            compact
            onSave={async (body) => {
              await create.mutateAsync(body);
              setQuickAddOpen(false);
            }}
            onCancel={() => setQuickAddOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Header({ month }: { month: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-sky-500/15 text-sky-600 dark:bg-sky-400/15 dark:text-sky-300">
        <Wallet className="h-4 w-4" />
      </div>
      <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
        Budget — {formatMonthLabel(month).split(' ')[0]}
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-2">
      <div className="h-4 w-32 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
      <div className="h-3 w-48 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
      <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
    </div>
  );
}

function EmptyState({ onOpen }: { onOpen: () => void }) {
  return (
    <div>
      <div className="text-sm text-slate-500 dark:text-slate-400">
        Track expenses and income against monthly targets.
      </div>
      <button
        type="button"
        onClick={onOpen}
        className="mt-2 text-xs text-sky-600 dark:text-sky-400 hover:underline"
      >
        Add your first transaction →
      </button>
    </div>
  );
}

function Body({ report }: { report: import('@pathforge/shared').BudgetReport }) {
  const { totals, targetTotals, currency, groups } = report;
  const expenseTarget = targetTotals.expense;
  const pct = expenseTarget > 0
    ? Math.min(100, Math.round((totals.expense / expenseTarget) * 100))
    : 0;

  // Top three expense categories by actual descending.
  const topExpense = groups
    .filter((g) => g.kind === 'expense')
    .flatMap((g) => g.categories)
    .filter((c) => c.actual > 0)
    .sort((a, b) => b.actual - a.actual)
    .slice(0, 3);

  const netColor = totals.net >= 0
    ? 'text-emerald-600 dark:text-emerald-400'
    : 'text-red-600 dark:text-red-400';

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] text-slate-500">Net so far</span>
        <span className={`text-base font-semibold tabular-nums ${netColor}`}>
          {totals.net >= 0 ? '+' : '−'}{formatMoney(Math.abs(totals.net), currency)}
        </span>
      </div>
      {expenseTarget > 0 ? (
        <div>
          <div className="flex items-baseline justify-between text-xs">
            <span className="text-slate-500">Spent</span>
            <span className="text-slate-700 dark:text-slate-300 tabular-nums">
              {formatMoney(totals.expense, currency)} of {formatMoney(expenseTarget, currency)}
            </span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div
              className={`h-full ${totals.expense > expenseTarget ? 'bg-red-500' : 'bg-emerald-500'}`}
              style={{ width: `${Math.min(100, pct)}%` }}
            />
          </div>
          <div className="mt-0.5 text-[10px] text-slate-500">{pct}% of plan</div>
        </div>
      ) : (
        <div className="text-xs text-slate-500">
          Spent {formatMoney(totals.expense, currency)} (no plan set).
        </div>
      )}
      {topExpense.length > 0 && (
        <div>
          <div className="text-[11px] text-slate-500 mb-1">Top categories</div>
          <ul className="space-y-0.5">
            {topExpense.map((c) => {
              const over = c.target > 0 && c.actual > c.target;
              return (
                <li
                  key={c.categoryId}
                  className="flex items-baseline justify-between text-xs"
                >
                  <span className="text-slate-700 dark:text-slate-300 truncate">{c.name}</span>
                  <span className="tabular-nums">
                    {formatMoney(c.actual, currency)}
                    {c.target > 0 && ` / ${formatMoney(c.target, currency)}`}
                    {over && <span className="ml-1 text-red-600">⚠</span>}
                    {!over && c.target > 0 && c.actual <= c.target && (
                      <span className="ml-1 text-emerald-600">✓</span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function Footer({ onAdd, onOpen }: { onAdd: () => void; onOpen: () => void }) {
  return (
    <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
      <button
        type="button"
        onClick={onAdd}
        className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
      >
        + Quick add
      </button>
      <button
        type="button"
        onClick={onOpen}
        className="text-xs text-sky-600 dark:text-sky-400 hover:underline"
      >
        Open Budget →
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Slot the widget into `apps/web/src/pages/Dashboard.tsx`**

Replace contents with:

```tsx
import { useMe } from '@/hooks/useAuth';
import { JournalTodayCard } from '@/components/journal/JournalTodayCard';
import { RoadmapsWidget } from '@/components/dashboard/RoadmapsWidget';
import { JobsWidget } from '@/components/dashboard/JobsWidget';
import { BudgetWidget } from '@/components/dashboard/BudgetWidget';

export default function Dashboard() {
  const { data: me } = useMe();
  return (
    <main className="container py-10 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Welcome, {me?.name}.</h1>
        <p className="text-muted-foreground mt-2">
          Today's pulse, plus your roadmaps, budget, and applications a click away.
        </p>
      </div>

      <JournalTodayCard />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <RoadmapsWidget />
        <JobsWidget />
        <BudgetWidget />
      </div>
    </main>
  );
}
```

(Three-column grid on `md+`; stacks to single column on small screens.)

- [ ] **Step 4: Manual smoke**

Navigate to `/`. Verify:
- Three widgets render side-by-side at desktop width.
- Budget widget shows current month, net so far, spent vs plan if a target is set, top 3 expense categories.
- "+ Quick add" opens a dialog with the input row; submitting adds a transaction and the widget updates.
- "Open Budget →" navigates to `/budget`.
- Empty state shows on a fresh user with no transactions.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit -p apps/web/tsconfig.json`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/dashboard/BudgetWidget.tsx apps/web/src/pages/Dashboard.tsx
git commit -m "$(cat <<'EOF'
feat(web): add BudgetWidget on the dashboard

Three-widget grid (Roadmaps / Jobs / Budget) replacing the prior
two-column layout. Budget widget shows month-to-date net, spent-vs-plan
progress (when a target is set), and the top three expense categories
with over/under indicators. "+ Quick add" opens a compact modal of the
input row so the dashboard supports add-transaction without navigation.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10 — End-to-end manual verification

**Files:** (verification only — no changes expected)

- [ ] **Step 1: Final typecheck**

Run: `npx tsc --noEmit -p apps/web/tsconfig.json && npx tsc --noEmit -p apps/api/tsconfig.json`
Expected: web is clean; API has only the pre-existing `journal-helpers.test.ts` errors (unrelated).

- [ ] **Step 2: Final test suite**

Run: `npm test --workspace=apps/api -- --run`
Expected: 142 tests pass (none broken by this frontend branch — the API surface is unchanged).

- [ ] **Step 3: End-to-end manual flow**

Bring up the stack (`docker compose up` or whatever is current), open the web app, log in as a dev user. Walk through:

1. **Navbar**: click "Budget" → lands on `/budget`. Tab strip shows Log / Plan / Report / Categories / Recurring / Settings.
2. **Categories** (`/budget/categories`): seven seeded groups appear; first group is auto-selected; six seeded categories load on the right. Create a new group ("Bonus"), create a new category in it ("Freelance" / income). Drag-reorder a few. Archive an empty group → succeeds; archive a group with live categories → 409 toast.
3. **Settings** (`/budget/settings`): change currency INR → USD → INR. Refresh; persists.
4. **Main log** (`/budget`): add an Income (Salary, ₹50,000). Add three Expenses (Rent ₹18,000, Groceries ₹6,400, Dining ₹3,200). Verify columns populate. Backdate one to last month → toast offers Switch. Edit an entry; delete an entry.
5. **Plan** (`/budget/plan`): set targets for the current month (Rent ₹18,000, Groceries ₹8,000, Dining ₹2,000). Save. Navigate to next month → carry-forward banner appears with last month's numbers as draft.
6. **Recurring** (`/budget/recurring`): create a "Rent" template (₹18,000, day 1). Apply it → transaction created. Second Apply → 409 toast. Edit + Delete (two-click).
7. **Report** (`/budget/report`): narrative reads "In <Month>, you spent ₹27,600 against a planned ₹28,000 — under by ₹400" (or similar). Dining shows "over" (₹3,200 vs ₹2,000). Groceries shows "under". Progress bars render.
8. **Dashboard** (`/`): Budget widget shows Net so far, Spent vs plan progress bar, top three expense categories. "+ Quick add" works; "Open Budget →" navigates.
9. **Currency change effect**: change currency to USD on settings, return to dashboard / report — symbols and grouping update (USD uses `100,000` grouping not `1,00,000`).

If any of the above breaks, fix it in place (or escalate as a follow-up). The plan is the spec, the spec is the ground truth.

- [ ] **Step 4: No commit required**

Verification only.

---

## Self-Review Notes

**Spec coverage (from `docs/superpowers/specs/2026-05-22-budget-feature-design.md`):**
- ✅ Six routes under `/budget/*` (Log, Plan, Report, Categories, Recurring, Settings) — Tasks 2 + 3-8.
- ✅ Navbar entry — Task 2.
- ✅ Shared tab strip — Task 2.
- ✅ Two-column UI on `/budget` with input row + month selector + net band — Task 5.
- ✅ Categories management (two-pane + drag-reorder + archive flow) — Task 4.
- ✅ Monthly targets form with carry-forward — Task 6.
- ✅ Recurring templates with opt-in apply (409 surfaced via toast) — Task 7.
- ✅ Retrospective report with narrative + group/category target-vs-actual bars — Task 8.
- ✅ Currency selector on `/budget/settings` (driven by existing PATCH /me) — Task 3.
- ✅ Dashboard widget with quick-add modal — Task 9.
- ✅ TanStack Query keys per spec: `['budget', 'groups' | 'categories' | 'transactions' | 'targets' | 'recurring' | 'report']` — Task 1.
- ✅ Aesthetic continuity (Inter, sky/emerald/red, existing shadcn/ui).

**Not implemented (deferred per spec):**
- Tour markers (`data-tour="..."`) for Budget. Spec doesn't list any; add when the onboarding tour grows to cover Budget.
- Cross-feature linking (category ↔ roadmap, transaction ↔ milestone). Spec defers to phase 2.
- Component tests for the input-row keyboard flow. The spec calls these out as valuable; not blocking for v1. The pattern is identical to what jobs/roadmaps do (no e2e), so this is symmetric with the rest of the project.

**Placeholders & ambiguity:** None. Every step lists exact files and exact code. Cross-task references match (the hook names, TanStack keys, and prop signatures introduced in Task 1 are the names used in Tasks 2-9).
