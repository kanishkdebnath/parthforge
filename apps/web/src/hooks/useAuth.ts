import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DevUser, User } from '@pathforge/shared';
import { api } from '@/lib/api';
import { todayLocal } from '@/lib/journalDate';

const ME_KEY = ['auth', 'me'] as const;

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
