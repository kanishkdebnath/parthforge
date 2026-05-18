import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  Roadmap,
  CreateRoadmapRequest,
  UpdateRoadmapRequest,
  CreateMilestoneRequest,
  UpdateMilestoneRequest,
  CreateStepRequest,
  UpdateStepRequest,
  BulkRoadmapRequest,
} from '@pathforge/shared';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { deriveCompletedAt } from '@/lib/milestone-progress';

const LIST_KEY = (archived: boolean) => ['roadmaps', 'list', { archived }] as const;
const DETAIL_KEY = (id: string) => ['roadmaps', 'detail', id] as const;
const LIST_PREFIX = ['roadmaps', 'list'] as const;

function showMutationError(err: unknown, fallback: string) {
  toast.error(fallback, {
    description: err instanceof Error ? err.message : 'Try again.',
  });
}

// ---------- Reads ----------

export function useRoadmaps({ archived }: { archived: boolean }) {
  return useQuery({
    queryKey: LIST_KEY(archived),
    queryFn: async (): Promise<Roadmap[]> => {
      const res = await api.get<Roadmap[]>('/roadmaps', { params: { archived } });
      return res.data;
    },
  });
}

export function useRoadmap(id: string | undefined) {
  return useQuery({
    queryKey: id ? DETAIL_KEY(id) : ['roadmaps', 'detail', '__none__'],
    enabled: !!id,
    queryFn: async (): Promise<Roadmap | null> => {
      try {
        const res = await api.get<Roadmap>(`/roadmaps/${id}`);
        return res.data;
      } catch (err: any) {
        if (err?.response?.status === 404) return null;
        throw err;
      }
    },
  });
}

// ---------- Roadmap CRUD ----------

export function useCreateRoadmap() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateRoadmapRequest): Promise<Roadmap> => {
      const res = await api.post<Roadmap>('/roadmaps', body);
      return res.data;
    },
    onError: (err) => showMutationError(err, 'Could not create roadmap'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: LIST_PREFIX });
    },
  });
}

export function useUpdateRoadmap(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: UpdateRoadmapRequest): Promise<Roadmap> => {
      const res = await api.patch<Roadmap>(`/roadmaps/${id}`, body);
      return res.data;
    },
    onError: (err) => showMutationError(err, 'Could not save roadmap'),
    onSuccess: (fresh) => {
      qc.setQueryData(DETAIL_KEY(id), fresh);
      qc.invalidateQueries({ queryKey: LIST_PREFIX });
    },
  });
}

export function useArchiveRoadmap(id: string) {
  const update = useUpdateRoadmap(id);
  return {
    ...update,
    archive: () => update.mutateAsync({ archived: true }),
    unarchive: () => update.mutateAsync({ archived: false }),
  };
}

export function useDeleteRoadmap(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<void> => {
      await api.delete(`/roadmaps/${id}`);
    },
    onError: (err) => showMutationError(err, 'Could not delete roadmap'),
    onSuccess: () => {
      qc.removeQueries({ queryKey: DETAIL_KEY(id) });
      qc.invalidateQueries({ queryKey: LIST_PREFIX });
    },
  });
}

// ---------- Milestone CRUD ----------

export function useAddMilestone(roadmapId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateMilestoneRequest): Promise<Roadmap> => {
      const res = await api.post<Roadmap>(`/roadmaps/${roadmapId}/milestones`, body);
      return res.data;
    },
    onError: (err) => showMutationError(err, 'Could not add milestone'),
    onSuccess: (fresh) => {
      qc.setQueryData(DETAIL_KEY(roadmapId), fresh);
      qc.invalidateQueries({ queryKey: LIST_PREFIX });
    },
  });
}

export function useUpdateMilestone(roadmapId: string, milestoneId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: UpdateMilestoneRequest): Promise<Roadmap> => {
      const res = await api.patch<Roadmap>(
        `/roadmaps/${roadmapId}/milestones/${milestoneId}`,
        body
      );
      return res.data;
    },
    onError: (err) => showMutationError(err, 'Could not save milestone'),
    onSuccess: (fresh) => {
      qc.setQueryData(DETAIL_KEY(roadmapId), fresh);
      qc.invalidateQueries({ queryKey: LIST_PREFIX });
    },
  });
}

export function useDeleteMilestone(roadmapId: string, milestoneId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<Roadmap> => {
      const res = await api.delete<Roadmap>(
        `/roadmaps/${roadmapId}/milestones/${milestoneId}`
      );
      return res.data;
    },
    onError: (err) => showMutationError(err, 'Could not delete milestone'),
    onSuccess: (fresh) => {
      qc.setQueryData(DETAIL_KEY(roadmapId), fresh);
      qc.invalidateQueries({ queryKey: LIST_PREFIX });
    },
  });
}

export function useReorderMilestones(roadmapId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]): Promise<Roadmap> => {
      const res = await api.put<Roadmap>(
        `/roadmaps/${roadmapId}/milestones/reorder`,
        { ids }
      );
      return res.data;
    },
    onMutate: async (ids) => {
      await qc.cancelQueries({ queryKey: DETAIL_KEY(roadmapId) });
      const prev = qc.getQueryData<Roadmap>(DETAIL_KEY(roadmapId));
      // Only apply the optimistic reorder when the submitted set is a
      // permutation of the existing set (same length + every id maps to a
      // current milestone). Mismatched callers would otherwise produce a
      // truncated list flash before the server response corrects it.
      if (prev && ids.length === prev.milestones.length) {
        const byId = new Map(prev.milestones.map((m) => [m._id, m]));
        if (ids.every((mid) => byId.has(mid))) {
          const optimistic: Roadmap = {
            ...prev,
            milestones: ids.map((mid) => byId.get(mid)!),
          };
          qc.setQueryData(DETAIL_KEY(roadmapId), optimistic);
        }
      }
      return { prev };
    },
    onError: (err, _ids, ctx) => {
      if (ctx?.prev) qc.setQueryData(DETAIL_KEY(roadmapId), ctx.prev);
      toast.error('Could not save milestone order', {
        description: err instanceof Error ? err.message : 'Try again.',
      });
    },
    onSuccess: (fresh) => {
      qc.setQueryData(DETAIL_KEY(roadmapId), fresh);
    },
  });
}

// ---------- Step CRUD ----------

export function useAddStep(roadmapId: string, milestoneId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateStepRequest): Promise<Roadmap> => {
      const res = await api.post<Roadmap>(
        `/roadmaps/${roadmapId}/milestones/${milestoneId}/steps`,
        body
      );
      return res.data;
    },
    onError: (err) => showMutationError(err, 'Could not add step'),
    onSuccess: (fresh) => {
      qc.setQueryData(DETAIL_KEY(roadmapId), fresh);
      qc.invalidateQueries({ queryKey: LIST_PREFIX });
    },
  });
}

export function useUpdateStep(roadmapId: string, milestoneId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { stepId: string; patch: UpdateStepRequest }): Promise<Roadmap> => {
      const res = await api.patch<Roadmap>(
        `/roadmaps/${roadmapId}/milestones/${milestoneId}/steps/${args.stepId}`,
        args.patch
      );
      return res.data;
    },
    onMutate: async ({ stepId, patch }) => {
      // Cancel any in-flight refetch unconditionally so a background fetch
      // can't overwrite the success handler's `setQueryData`. The optimistic
      // *write* only happens when `completed` flips — title/link edits still
      // get cache-cancel safety but no optimistic mutation of the cache.
      await qc.cancelQueries({ queryKey: DETAIL_KEY(roadmapId) });
      if (patch.completed === undefined) return {};
      const prev = qc.getQueryData<Roadmap>(DETAIL_KEY(roadmapId));
      if (!prev) return { prev };
      const optimistic: Roadmap = {
        ...prev,
        milestones: prev.milestones.map((m) => {
          if (m._id !== milestoneId) return m;
          const nextSteps = m.steps.map((s) =>
            s._id === stepId
              ? { ...s, completed: patch.completed!, completedAt: patch.completed ? new Date() : undefined }
              : s
          );
          return { ...m, steps: nextSteps, completedAt: deriveCompletedAt(nextSteps) };
        }),
      };
      qc.setQueryData(DETAIL_KEY(roadmapId), optimistic);
      return { prev };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(DETAIL_KEY(roadmapId), ctx.prev);
      toast.error('Could not save step', {
        description: err instanceof Error ? err.message : 'Try again.',
      });
    },
    onSuccess: (fresh) => {
      qc.setQueryData(DETAIL_KEY(roadmapId), fresh);
      qc.invalidateQueries({ queryKey: LIST_PREFIX });
    },
  });
}

export function useDeleteStep(roadmapId: string, milestoneId: string, stepId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<Roadmap> => {
      const res = await api.delete<Roadmap>(
        `/roadmaps/${roadmapId}/milestones/${milestoneId}/steps/${stepId}`
      );
      return res.data;
    },
    onError: (err) => showMutationError(err, 'Could not delete step'),
    onSuccess: (fresh) => {
      qc.setQueryData(DETAIL_KEY(roadmapId), fresh);
      qc.invalidateQueries({ queryKey: LIST_PREFIX });
    },
  });
}

export function useReorderSteps(roadmapId: string, milestoneId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]): Promise<Roadmap> => {
      const res = await api.put<Roadmap>(
        `/roadmaps/${roadmapId}/milestones/${milestoneId}/steps/reorder`,
        { ids }
      );
      return res.data;
    },
    onMutate: async (ids) => {
      await qc.cancelQueries({ queryKey: DETAIL_KEY(roadmapId) });
      const prev = qc.getQueryData<Roadmap>(DETAIL_KEY(roadmapId));
      // Only apply when ids is a permutation of the target milestone's
      // current step set — see useReorderMilestones onMutate for rationale.
      if (prev) {
        const target = prev.milestones.find((m) => m._id === milestoneId);
        if (target && ids.length === target.steps.length) {
          const byId = new Map(target.steps.map((s) => [s._id, s]));
          if (ids.every((sid) => byId.has(sid))) {
            const optimistic: Roadmap = {
              ...prev,
              milestones: prev.milestones.map((m) =>
                m._id !== milestoneId
                  ? m
                  : { ...m, steps: ids.map((sid) => byId.get(sid)!) }
              ),
            };
            qc.setQueryData(DETAIL_KEY(roadmapId), optimistic);
          }
        }
      }
      return { prev };
    },
    onError: (err, _ids, ctx) => {
      if (ctx?.prev) qc.setQueryData(DETAIL_KEY(roadmapId), ctx.prev);
      toast.error('Could not save step order', {
        description: err instanceof Error ? err.message : 'Try again.',
      });
    },
    onSuccess: (fresh) => {
      qc.setQueryData(DETAIL_KEY(roadmapId), fresh);
    },
  });
}

// ---------- Bulk import ----------

/**
 * Posts a full roadmap-tree payload to /roadmaps/bulk. On success invalidates
 * the list cache (so the new roadmap appears in the listing the user returns
 * to) and resolves with the created `Roadmap` so the caller can navigate.
 *
 * Errors are NOT auto-toasted here because the dialog renders structured 400
 * errors inline. The caller's `mutateAsync` rejection handler decides whether
 * to surface a toast (network/500) or render inline errors (400 from Zod).
 */
export function useBulkCreateRoadmap() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: BulkRoadmapRequest): Promise<Roadmap> => {
      const res = await api.post<Roadmap>('/roadmaps/bulk', body);
      return res.data;
    },
    onSuccess: (fresh) => {
      qc.setQueryData(DETAIL_KEY(fresh._id), fresh);
      qc.invalidateQueries({ queryKey: LIST_PREFIX });
    },
  });
}
