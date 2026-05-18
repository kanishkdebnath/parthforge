import { useEffect, useMemo, useRef, useState } from 'react';
import type { BulkRoadmapRequest } from '@pathforge/shared';
import { BulkRoadmapRequestSchema } from '@pathforge/shared';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const MAX_FILE_BYTES = 256 * 1024;

type Validation =
  | { kind: 'empty' }
  | { kind: 'invalid'; message: string; fieldErrors?: string[] }
  | { kind: 'valid'; data: BulkRoadmapRequest; summary: string };

function validate(raw: string): Validation {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return { kind: 'empty' };
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return {
      kind: 'invalid',
      message: "Couldn't parse JSON — check for trailing commas or missing quotes.",
    };
  }
  const result = BulkRoadmapRequestSchema.safeParse(parsed);
  if (!result.success) {
    const fieldErrors = result.error.issues.slice(0, 5).map((i) => {
      const path = i.path
        .map((p) => (typeof p === 'number' ? `[${p}]` : p))
        .join('.')
        .replace(/\.\[/g, '[');
      return `${path || '(root)'}: ${i.message}`;
    });
    const overflow = result.error.issues.length - fieldErrors.length;
    return {
      kind: 'invalid',
      message: 'JSON does not match the schema.',
      fieldErrors:
        overflow > 0 ? [...fieldErrors, `…and ${overflow} more`] : fieldErrors,
    };
  }
  const stepCount = result.data.milestones.reduce(
    (n, m) => n + m.steps.length,
    0
  );
  const linkCount = result.data.milestones.reduce(
    (n, m) => n + m.steps.reduce((k, s) => k + s.links.length, 0),
    0
  );
  return {
    kind: 'valid',
    data: result.data,
    summary: `Ready — ${result.data.milestones.length} milestones, ${stepCount} steps, ${linkCount} links.`,
  };
}

interface Props {
  pending: boolean;
  serverErrors: { path: string; message: string }[] | null;
  onCancel: () => void;
  onSubmit: (data: BulkRoadmapRequest) => void;
}

export function ImportPastePanel({ pending, serverErrors, onCancel, onSubmit }: Props) {
  const [raw, setRaw] = useState('');
  const [debouncedRaw, setDebouncedRaw] = useState('');
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedRaw(raw), 250);
    return () => window.clearTimeout(t);
  }, [raw]);

  const liveValidation = useMemo(() => validate(raw), [raw]);
  const debouncedValidation = useMemo(() => validate(debouncedRaw), [debouncedRaw]);

  const handleFile = (file: File) => {
    if (file.size > MAX_FILE_BYTES) {
      toast.error('File too large (max 256KB).');
      return;
    }
    if (raw.trim().length > 0) {
      const ok = window.confirm('Replace pasted JSON?');
      if (!ok) return;
    }
    const reader = new FileReader();
    reader.onerror = () => toast.error("Couldn't read file.");
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      setRaw(text);
    };
    reader.readAsText(file);
  };

  const submit = () => {
    if (liveValidation.kind !== 'valid') return;
    onSubmit(liveValidation.data);
  };

  const showState = debouncedValidation;
  const canSubmit = liveValidation.kind === 'valid' && !pending;

  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">2. Paste the result</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Paste the LLM's JSON response or upload it as a file.
        </p>
      </div>

      <Textarea
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        rows={12}
        placeholder='{ "roadmap": { ... }, "milestones": [ ... ] }'
        aria-label="Roadmap JSON"
        aria-invalid={showState.kind === 'invalid'}
        className={
          showState.kind === 'invalid'
            ? 'font-mono text-xs border-overdue/60 focus-visible:ring-overdue/40'
            : 'font-mono text-xs'
        }
      />

      <div className="flex items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = '';
          }}
        />
        <Button variant="ghost" onClick={() => fileRef.current?.click()}>
          Upload .json file
        </Button>
      </div>

      <div
        role={showState.kind === 'invalid' ? 'alert' : undefined}
        aria-live="polite"
        className="min-h-[1.25rem]"
      >
        {showState.kind === 'empty' && (
          <p className="text-xs text-slate-500 dark:text-slate-400">Paste JSON or upload a file.</p>
        )}
        {showState.kind === 'invalid' && (
          <div className="text-xs text-overdue">
            <p className="font-medium">{showState.message}</p>
            {showState.fieldErrors && showState.fieldErrors.length > 0 && (
              <ul className="mt-1 list-disc list-inside space-y-0.5">
                {showState.fieldErrors.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            )}
          </div>
        )}
        {showState.kind === 'valid' && (
          <p className="text-xs text-done font-medium">✓ {showState.summary}</p>
        )}
      </div>

      {serverErrors && serverErrors.length > 0 && (
        <div role="alert" className="text-xs text-overdue">
          <p className="font-medium">Server rejected the payload:</p>
          <ul className="mt-1 list-disc list-inside space-y-0.5">
            {serverErrors.map((e, i) => (
              <li key={`${i}-${e.path}`}>
                {e.path || '(root)'}: {e.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-center justify-end gap-2 pt-2">
        <Button variant="ghost" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <Button
          onClick={submit}
          disabled={!canSubmit}
          className="bg-brand text-white hover:bg-brand-hover"
        >
          {pending ? 'Creating…' : 'Create roadmap'}
        </Button>
      </div>
    </section>
  );
}
