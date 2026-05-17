import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  Roadmap,
  CreateRoadmapRequest,
  UpdateRoadmapRequest,
  CreateMilestoneRequest,
  UpdateMilestoneRequest,
  CreateStepRequest,
  UpdateStepRequest,
} from '@pathforge/shared';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { deriveCompletedAt } from '@/lib/milestone-progress';

const LIST_KEY = (archived: boolean) => ['roadmaps', 'list', { archived }] as const;
const DETAIL_KEY = (id: string) => ['roadmaps', 'detail', id] as const;
const LIST_PREFIX = ['roadmaps', 'list'] as const;

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
      if (prev) {
        const byId = new Map(prev.milestones.map((m) => [m._id, m]));
        const optimistic: Roadmap = {
          ...prev,
          milestones: ids.map((mid) => byId.get(mid)!).filter(Boolean),
        };
        qc.setQueryData(DETAIL_KEY(roadmapId), optimistic);
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
      // Optimistic only when `completed` flips — title/link edits use the
      // standard invalidation pattern.
      if (patch.completed === undefined) return {};
      await qc.cancelQueries({ queryKey: DETAIL_KEY(roadmapId) });
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
      if (prev) {
        const optimistic: Roadmap = {
          ...prev,
          milestones: prev.milestones.map((m) => {
            if (m._id !== milestoneId) return m;
            const byId = new Map(m.steps.map((s) => [s._id, s]));
            return { ...m, steps: ids.map((sid) => byId.get(sid)!).filter(Boolean) };
          }),
        };
        qc.setQueryData(DETAIL_KEY(roadmapId), optimistic);
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
