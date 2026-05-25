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
    queryKey: [...CATEGORIES_KEY, filter?.groupId ?? null, filter?.kind ?? null] as const,
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

/**
 * DELETEs a set of targets in parallel. Used by the plan page when the
 * user clears a target input and saves — the bulk PUT endpoint upserts
 * the items passed but doesn't remove omitted ones, so the cleared
 * targets need a separate DELETE pass to actually disappear.
 *
 * Takes both the ids and the month so we can invalidate the right keys
 * without an extra fetch.
 */
type ClearTargetsBody = { ids: string[]; month: string };

export function useClearBudgetTargets() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ ids }: ClearTargetsBody): Promise<void> => {
      await Promise.all(ids.map((id) => api.delete(`/budget/targets/${id}`)));
    },
    onSuccess: (_void, vars) => {
      qc.invalidateQueries({ queryKey: TARGETS_KEY(vars.month) });
      qc.invalidateQueries({ queryKey: REPORT_KEY(vars.month) });
    },
    onError: (err) => toastError('Could not clear targets', err),
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

