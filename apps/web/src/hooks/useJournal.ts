import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { toast } from 'sonner';
import type { JournalDay, UpsertJournalDayRequest } from '@pathforge/shared';
import { api } from '../lib/api';
import { firstOfMonth, lastOfMonth, monthOf } from '../lib/journalDate';

interface ServerErrorBody {
  error?: string;
  message?: string;
  details?: Array<{ path: string; message: string }>;
}

function toastError(fallback: string, err: unknown): void {
  let msg = fallback;
  if (err instanceof AxiosError) {
    const data = err.response?.data as ServerErrorBody | undefined;
    if (data?.details && data.details.length > 0) {
      const first = data.details[0]!;
      msg = first.path ? `${first.path}: ${first.message}` : first.message;
    } else if (data?.error) {
      msg = data.error;
    }
  }
  toast.error(msg);
}

const DAY_KEY = (date: string) => ['journal', 'day', date] as const;
const MONTH_KEY = (yyyyMm: string) => ['journal', 'month', yyyyMm] as const;

export function useJournalMonth(yyyyMm: string) {
  return useQuery({
    queryKey: MONTH_KEY(yyyyMm),
    queryFn: async (): Promise<JournalDay[]> => {
      const from = firstOfMonth(`${yyyyMm}-01`);
      const to = lastOfMonth(`${yyyyMm}-01`);
      const res = await api.get('/journal/days', { params: { from, to } });
      return res.data;
    },
  });
}

export function useJournalDay(date: string) {
  return useQuery({
    queryKey: DAY_KEY(date),
    queryFn: async (): Promise<JournalDay | null> => {
      try {
        const res = await api.get(`/journal/days/${date}`);
        return res.data;
      } catch (err) {
        if (err instanceof AxiosError && err.response?.status === 404) return null;
        throw err;
      }
    },
  });
}

export function useUpsertJournalDay(date: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: UpsertJournalDayRequest): Promise<JournalDay> => {
      const res = await api.put(`/journal/days/${date}`, body);
      return res.data;
    },
    onSuccess: (fresh) => {
      qc.setQueryData(DAY_KEY(date), fresh);
      qc.invalidateQueries({ queryKey: MONTH_KEY(monthOf(date)) });
    },
    onError: (err) => {
      toastError('Could not save journal entry', err);
    },
  });
}

export function useDeleteJournalDay(date: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await api.delete(`/journal/days/${date}`);
    },
    onSuccess: () => {
      qc.setQueryData(DAY_KEY(date), null);
      qc.invalidateQueries({ queryKey: MONTH_KEY(monthOf(date)) });
    },
    onError: (err) => {
      toastError('Could not delete journal entry', err);
    },
  });
}
