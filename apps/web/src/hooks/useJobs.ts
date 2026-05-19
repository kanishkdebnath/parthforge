import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { toast } from 'sonner';
import type {
  JobApplication,
  JobApplicationStatus,
  RoundOutcome,
  WorkMode,
} from '@pathforge/shared';
import { api } from '../lib/api';

// ---- Error helpers ----

interface ServerErrorBody {
  error?: string;
  details?: Array<{ path: string; message: string }>;
}

/**
 * Surface a useful error message in the toast — server validation detail
 * when the API returns one, otherwise the generic fallback.
 */
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
    if (typeof data?.error === 'string') return data.error;
    if (!err.response) return `Network error: ${err.message}`;
  }
  return undefined;
}

function extractDescription(err: unknown): string | undefined {
  if (!(err instanceof AxiosError)) return undefined;
  const data = err.response?.data as ServerErrorBody | undefined;
  if (!data?.details || data.details.length <= 1) return undefined;
  // More than one issue — list the rest as a secondary line.
  return data.details
    .slice(1)
    .map((d) => (d.path ? `${d.path}: ${d.message}` : d.message))
    .join(' · ');
}

// ---- Query keys ----
const LIST_KEY = (archived: boolean) =>
  ['jobs', 'list', { archived }] as const;
const DETAIL_KEY = (id: string) => ['jobs', 'detail', id] as const;
const LIST_PREFIX = ['jobs', 'list'] as const;

// ---- Request body shapes (mirror packages/shared, narrowed to what web sends) ----
type CreateJobBody = {
  company: string;
  role: string;
  jobUrl?: string;
  status?: JobApplicationStatus;
  appliedAt?: Date;
  resumeUrl?: string;
  location?: string;
  workMode?: WorkMode;
  salaryRange?: string;
  offerAmount?: string;
  tags?: string[];
  notes?: string;
  links?: { roadmapId?: string };
};

type UpdateJobBody = {
  company?: string | null;
  role?: string | null;
  jobUrl?: string | null;
  status?: JobApplicationStatus | null;
  appliedAt?: Date | null;
  resumeUrl?: string | null;
  location?: string | null;
  workMode?: WorkMode | null;
  salaryRange?: string | null;
  offerAmount?: string | null;
  tags?: string[] | null;
  notes?: string | null;
  links?: { roadmapId?: string | null };
  archived?: boolean;
};

type CreateRoundBody = {
  name: string;
  scheduledAt?: Date;
  durationMinutes?: number;
  interviewer?: string;
  outcome?: RoundOutcome;
  prepNotes?: string;
  questions?: string[];
  experience?: string;
};

type UpdateRoundBody = {
  [K in keyof CreateRoundBody]?: CreateRoundBody[K] | null;
};

type CreateContactBody = {
  name: string;
  role?: string;
  email?: string;
};

type UpdateContactBody = {
  [K in keyof CreateContactBody]?: CreateContactBody[K] | null;
};

// ---- Reads ----

export function useJobs({ archived }: { archived: boolean }) {
  return useQuery({
    queryKey: LIST_KEY(archived),
    queryFn: async (): Promise<JobApplication[]> => {
      const res = await api.get('/jobs', { params: { archived } });
      return res.data;
    },
  });
}

export function useJob(id: string | undefined) {
  return useQuery({
    queryKey: id ? DETAIL_KEY(id) : ['jobs', 'detail', 'none'],
    enabled: !!id,
    queryFn: async (): Promise<JobApplication | null> => {
      if (!id) return null;
      try {
        const res = await api.get(`/jobs/${id}`);
        return res.data;
      } catch (err) {
        if (err instanceof AxiosError && err.response?.status === 404) {
          return null;
        }
        throw err;
      }
    },
  });
}

// ---- Application CRUD ----

export function useCreateJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateJobBody): Promise<JobApplication> => {
      const res = await api.post('/jobs', body);
      return res.data;
    },
    onSuccess: (fresh) => {
      qc.setQueryData(DETAIL_KEY(fresh._id), fresh);
      qc.invalidateQueries({ queryKey: LIST_PREFIX });
    },
    onError: (err) => {
      toastError('Could not create application', err);
    },
  });
}

export function useUpdateJob(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: UpdateJobBody): Promise<JobApplication> => {
      const res = await api.patch(`/jobs/${id}`, body);
      return res.data;
    },
    // Optimize only the status flip (the most frequent inline action via
    // the sidebar status picker). Other patches go through the normal
    // success path. Mirrors the useUpdateStep partial-optimistic shape
    // in useRoadmaps.
    onMutate: async (body) => {
      if (body.status === undefined) return {};
      await qc.cancelQueries({ queryKey: DETAIL_KEY(id) });
      const prev = qc.getQueryData<JobApplication>(DETAIL_KEY(id));
      if (!prev) return { prev };
      qc.setQueryData<JobApplication>(DETAIL_KEY(id), {
        ...prev,
        status: body.status as JobApplication['status'],
      });
      return { prev };
    },
    onError: (err, _body, ctx) => {
      if (ctx?.prev) qc.setQueryData(DETAIL_KEY(id), ctx.prev);
      toastError('Could not save changes', err);
    },
    onSuccess: (fresh) => {
      qc.setQueryData(DETAIL_KEY(id), fresh);
      qc.invalidateQueries({ queryKey: LIST_PREFIX });
    },
  });
}

export function useArchiveJob(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (archived: boolean): Promise<JobApplication> => {
      const res = await api.patch(`/jobs/${id}`, { archived });
      return res.data;
    },
    onMutate: async (archived) => {
      await qc.cancelQueries({ queryKey: DETAIL_KEY(id) });
      const prev = qc.getQueryData<JobApplication>(DETAIL_KEY(id));
      if (prev) {
        qc.setQueryData<JobApplication>(DETAIL_KEY(id), {
          ...prev,
          archived,
        });
      }
      return { prev };
    },
    onError: (err, _archived, ctx) => {
      if (ctx?.prev) qc.setQueryData(DETAIL_KEY(id), ctx.prev);
      toastError('Could not change archive state', err);
    },
    onSuccess: (fresh) => {
      qc.setQueryData(DETAIL_KEY(id), fresh);
      qc.invalidateQueries({ queryKey: LIST_PREFIX });
    },
  });
}

export function useDeleteJob(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await api.delete(`/jobs/${id}`);
    },
    onSuccess: () => {
      qc.removeQueries({ queryKey: DETAIL_KEY(id) });
      qc.invalidateQueries({ queryKey: LIST_PREFIX });
    },
    onError: (err) => {
      toastError('Could not delete application', err);
    },
  });
}

// ---- Round CRUD ----

export function useAddRound(jobId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateRoundBody): Promise<JobApplication> => {
      const res = await api.post(`/jobs/${jobId}/rounds`, body);
      return res.data;
    },
    onSuccess: (fresh) => {
      qc.setQueryData(DETAIL_KEY(jobId), fresh);
      qc.invalidateQueries({ queryKey: LIST_PREFIX });
    },
    onError: (err) => {
      toastError('Could not add round', err);
    },
  });
}

export function useUpdateRound(jobId: string, roundId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: UpdateRoundBody): Promise<JobApplication> => {
      const res = await api.patch(`/jobs/${jobId}/rounds/${roundId}`, body);
      return res.data;
    },
    onMutate: async (body) => {
      // Optimize only outcome flips — the most frequent inline action.
      if (body.outcome === undefined) return {};
      await qc.cancelQueries({ queryKey: DETAIL_KEY(jobId) });
      const prev = qc.getQueryData<JobApplication>(DETAIL_KEY(jobId));
      if (!prev) return { prev };
      const next: JobApplication = {
        ...prev,
        rounds: prev.rounds.map((r) =>
          r._id === roundId ? { ...r, outcome: body.outcome as RoundOutcome } : r
        ),
      };
      qc.setQueryData(DETAIL_KEY(jobId), next);
      return { prev };
    },
    onError: (err, _body, ctx) => {
      if (ctx?.prev) qc.setQueryData(DETAIL_KEY(jobId), ctx.prev);
      toastError('Could not save round', err);
    },
    onSuccess: (fresh) => {
      qc.setQueryData(DETAIL_KEY(jobId), fresh);
      qc.invalidateQueries({ queryKey: LIST_PREFIX });
    },
  });
}

export function useDeleteRound(jobId: string, roundId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<JobApplication> => {
      const res = await api.delete(`/jobs/${jobId}/rounds/${roundId}`);
      return res.data;
    },
    onSuccess: (fresh) => {
      qc.setQueryData(DETAIL_KEY(jobId), fresh);
      qc.invalidateQueries({ queryKey: LIST_PREFIX });
    },
    onError: (err) => {
      toastError('Could not delete round', err);
    },
  });
}

export function useReorderRounds(jobId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]): Promise<JobApplication> => {
      const res = await api.put(`/jobs/${jobId}/rounds/order`, { ids });
      return res.data;
    },
    onMutate: async (ids) => {
      await qc.cancelQueries({ queryKey: DETAIL_KEY(jobId) });
      const prev = qc.getQueryData<JobApplication>(DETAIL_KEY(jobId));
      if (prev && ids.length === prev.rounds.length) {
        const byId = new Map(prev.rounds.map((r) => [r._id, r]));
        if (ids.every((rid) => byId.has(rid))) {
          qc.setQueryData<JobApplication>(DETAIL_KEY(jobId), {
            ...prev,
            rounds: ids.map((rid) => byId.get(rid)!),
          });
        }
      }
      return { prev };
    },
    onError: (err, _ids, ctx) => {
      if (ctx?.prev) qc.setQueryData(DETAIL_KEY(jobId), ctx.prev);
      toastError('Could not save round order', err);
    },
    onSuccess: (fresh) => {
      qc.setQueryData(DETAIL_KEY(jobId), fresh);
    },
  });
}

// ---- Contact CRUD ----

export function useAddContact(jobId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateContactBody): Promise<JobApplication> => {
      const res = await api.post(`/jobs/${jobId}/contacts`, body);
      return res.data;
    },
    onSuccess: (fresh) => {
      qc.setQueryData(DETAIL_KEY(jobId), fresh);
      qc.invalidateQueries({ queryKey: LIST_PREFIX });
    },
    onError: (err) => {
      toastError('Could not add contact', err);
    },
  });
}

export function useUpdateContact(jobId: string, contactId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: UpdateContactBody): Promise<JobApplication> => {
      const res = await api.patch(
        `/jobs/${jobId}/contacts/${contactId}`,
        body
      );
      return res.data;
    },
    onSuccess: (fresh) => {
      qc.setQueryData(DETAIL_KEY(jobId), fresh);
      qc.invalidateQueries({ queryKey: LIST_PREFIX });
    },
    onError: (err) => {
      toastError('Could not save contact', err);
    },
  });
}

export function useDeleteContact(jobId: string, contactId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<JobApplication> => {
      const res = await api.delete(`/jobs/${jobId}/contacts/${contactId}`);
      return res.data;
    },
    onSuccess: (fresh) => {
      qc.setQueryData(DETAIL_KEY(jobId), fresh);
      qc.invalidateQueries({ queryKey: LIST_PREFIX });
    },
    onError: (err) => {
      toastError('Could not delete contact', err);
    },
  });
}
