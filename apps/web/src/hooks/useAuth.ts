import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { toast } from 'sonner';
import type { DevUser, UpdateMeRequest, User } from '@pathforge/shared';
import { api } from '@/lib/api';
import { todayLocal } from '@/lib/journalDate';

const ME_KEY = ['auth', 'me'] as const;

interface ServerErrorBody {
  error?: string;
  details?: Array<{ path: string; message: string }>;
}

function toastApiError(fallback: string, err: unknown): void {
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

export function useMe() {
  return useQuery({
    queryKey: ME_KEY,
    queryFn: async (): Promise<User | null> => {
      try {
        const res = await api.get<User>('/auth/me');
        return res.data;
      } catch (err: any) {
        if (err?.response?.status === 401) return null;
        throw err;
      }
    },
  });
}

export function useDevUsers() {
  return useQuery({
    queryKey: ['auth', 'dev-users'],
    queryFn: async (): Promise<DevUser[]> => {
      const res = await api.get<DevUser[]>('/auth/dev-users');
      return res.data;
    },
  });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      // Pass the browser's local YYYY-MM-DD so the demo-reset hook anchors
      // seeded journal days to the user's calendar, not the server's UTC day.
      await api.post('/auth/login', { userId, clientToday: todayLocal() });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ME_KEY });
    },
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await api.post('/auth/logout');
    },
    onSuccess: () => {
      qc.setQueryData(ME_KEY, null);
      qc.invalidateQueries({ queryKey: ME_KEY });
    },
  });
}

export function useUpdateMe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: UpdateMeRequest): Promise<User> => {
      const res = await api.patch<User>('/auth/me', body);
      return res.data;
    },
    onSuccess: (fresh) => {
      qc.setQueryData(ME_KEY, fresh);
    },
    onError: (err) => {
      toastApiError('Could not save profile', err);
    },
  });
}
