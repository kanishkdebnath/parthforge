# Roadmaps LLM Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an "Import from LLM" flow that generates a copyable prompt from a user goal, accepts the LLM's JSON response (pasted or uploaded), validates it, and creates a complete roadmap in one bulk request.

**Architecture:** A new Zod schema in `@pathforge/shared` defines the bulk payload shape (roadmap + milestones + steps + links). A new `POST /api/roadmaps/bulk` endpoint atomically creates the document via `RoadmapModel.create`. The frontend ships a two-panel dialog: the top panel collects the goal and live-interpolates a prompt for copying; the bottom panel validates pasted/uploaded JSON against the same schema and submits via a new `useBulkCreateRoadmap` hook that navigates to the new detail page on success.

**Tech Stack:** Zod 3, Mongoose 8 + Fastify 4 (backend), React 18 + shadcn/ui Dialog/Input/Textarea/Button + TanStack Query 5 + react-router-dom + sonner toasts (frontend), Vitest for shared schema tests.

**Spec reference:** [docs/superpowers/specs/2026-05-18-roadmaps-llm-import-design.md](../specs/2026-05-18-roadmaps-llm-import-design.md)

---

## File Map

**Create:**
- `apps/web/src/lib/llm-prompt.ts` — `JSON_TEMPLATE`, `buildPrompt(goal: string)`
- `apps/web/src/lib/clipboard.ts` — `copyText(s: string): Promise<boolean>`
- `apps/web/src/components/roadmaps/ImportPromptPanel.tsx` — form panel (goal input + interpolated prompt + copy buttons)
- `apps/web/src/components/roadmaps/ImportPastePanel.tsx` — validate-and-submit panel (textarea + file upload + validation summary + submit)
- `apps/web/src/components/roadmaps/ImportRoadmapDialog.tsx` — Dialog shell composing the two panels
- `apps/web/src/components/roadmaps/ImportRoadmapButton.tsx` — ghost-variant trigger button with Sparkles icon
- `apps/api/test/bulk-roadmap-schema.test.ts` — Zod parsing tests for `BulkRoadmapRequestSchema`

**Modify:**
- `packages/shared/src/roadmap.ts` — add `BulkRoadmapRequestSchema` + `BulkRoadmapRequest` type export
- `apps/api/src/routes/roadmaps.ts` — add `POST /api/roadmaps/bulk` handler
- `apps/web/src/hooks/useRoadmaps.ts` — add `useBulkCreateRoadmap`
- `apps/web/src/components/roadmaps/ListPageHeader.tsx` — render `<ImportRoadmapButton />` to the left of the primary "+ New roadmap" button
- `apps/web/src/pages/RoadmapsListPage.tsx` — own the import-dialog open state and render `<ImportRoadmapDialog />`
- `docs/PROJECT.md` — append a changelog entry

---

## Task 1: Shared `BulkRoadmapRequestSchema`

**Files:**
- Modify: `packages/shared/src/roadmap.ts`
- Test: `apps/api/test/bulk-roadmap-schema.test.ts`

This schema is the contract for both the backend handler and the frontend validation step. It mirrors existing single-item shapes but adds two things the wider codebase doesn't enforce: an `http:`/`https:` protocol allowlist on links (defense-in-depth against LLM-generated `javascript:` URLs) and a single source of truth for the whole bulk payload.

- [ ] **Step 1: Write the failing test file**

Create `apps/api/test/bulk-roadmap-schema.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { BulkRoadmapRequestSchema } from '@pathforge/shared';

const validPayload = {
  roadmap: { title: 'Learn Rust' },
  milestones: [
    {
      title: 'Foundation',
      steps: [
        { title: 'Read chapter 1' },
        { title: 'Run cargo test', links: [{ url: 'https://doc.rust-lang.org/book/' }] },
      ],
    },
  ],
};

describe('BulkRoadmapRequestSchema', () => {
  it('accepts a minimal valid payload (titles only)', () => {
    const result = BulkRoadmapRequestSchema.safeParse({
      roadmap: { title: 'Test' },
      milestones: [{ title: 'M1' }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.milestones[0]?.steps).toEqual([]);
    }
  });

  it('accepts a full payload with deadlines and links', () => {
    const result = BulkRoadmapRequestSchema.safeParse({
      roadmap: { title: 'Learn Rust', description: 'Three-month plan', deadline: '2026-08-01' },
      milestones: [
        {
          title: 'Foundation',
          description: 'Basics',
          deadline: '2026-06-01',
          steps: [
            { title: 'Read book', links: [{ url: 'https://doc.rust-lang.org/book/', label: 'The Book' }] },
          ],
        },
      ],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.roadmap.deadline).toBeInstanceOf(Date);
      expect(result.data.milestones[0]?.deadline).toBeInstanceOf(Date);
    }
  });

  it('rejects payload missing roadmap title', () => {
    const result = BulkRoadmapRequestSchema.safeParse({
      roadmap: {},
      milestones: [{ title: 'M1' }],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'));
      expect(paths).toContain('roadmap.title');
    }
  });

  it('rejects payload with empty milestones array', () => {
    const result = BulkRoadmapRequestSchema.safeParse({
      roadmap: { title: 'T' },
      milestones: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejects javascript: URLs in step links', () => {
    const result = BulkRoadmapRequestSchema.safeParse({
      roadmap: { title: 'T' },
      milestones: [
        {
          title: 'M',
          steps: [{ title: 'S', links: [{ url: 'javascript:alert(1)' }] }],
        },
      ],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'));
      expect(paths.some((p) => p.includes('milestones.0.steps.0.links.0.url'))).toBe(true);
    }
  });

  it('rejects step title longer than 200 chars', () => {
    const longTitle = 'x'.repeat(201);
    const result = BulkRoadmapRequestSchema.safeParse({
      roadmap: { title: 'T' },
      milestones: [{ title: 'M', steps: [{ title: longTitle }] }],
    });
    expect(result.success).toBe(false);
  });

  it('accepts payload with deadline supplied as ISO YYYY-MM-DD string and coerces to Date', () => {
    const result = BulkRoadmapRequestSchema.safeParse({
      roadmap: { title: 'T', deadline: '2026-12-31' },
      milestones: [{ title: 'M' }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.roadmap.deadline).toBeInstanceOf(Date);
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test --workspace @pathforge/api -- bulk-roadmap-schema`
Expected: FAIL — `BulkRoadmapRequestSchema is not exported from @pathforge/shared`.

- [ ] **Step 3: Add the schema to `packages/shared/src/roadmap.ts`**

Append to the bottom of `packages/shared/src/roadmap.ts` (after `ReorderRequestSchema`):

```typescript
// Bulk import — accepts a full roadmap tree in a single request.
// Used by POST /api/roadmaps/bulk and the "Import from LLM" frontend flow.
// Field caps mirror single-item schemas where they exist; we add explicit
// max(200) on titles + max(2000) on descriptions so an LLM can't blow past
// reasonable bounds. The link URL is narrowed to http/https as defense in
// depth against javascript:/data: URLs in untrusted LLM output (the wider
// LinkSchema is intentionally permissive for backwards compat).
const BulkLinkSchema = z.object({
  url: z
    .string()
    .url()
    .refine(
      (v) => {
        try {
          const u = new URL(v);
          return u.protocol === 'http:' || u.protocol === 'https:';
        } catch {
          return false;
        }
      },
      { message: 'URL must use http or https' }
    ),
  label: z.string().max(200).optional(),
});

export const BulkRoadmapRequestSchema = z.object({
  roadmap: z.object({
    title: z.string().min(1).max(200),
    description: z.string().max(2000).optional(),
    deadline: z.coerce.date().optional(),
  }),
  milestones: z
    .array(
      z.object({
        title: z.string().min(1).max(200),
        description: z.string().max(2000).optional(),
        deadline: z.coerce.date().optional(),
        steps: z
          .array(
            z.object({
              title: z.string().min(1).max(200),
              links: z.array(BulkLinkSchema).optional().default([]),
            })
          )
          .optional()
          .default([]),
      })
    )
    .min(1),
});

export type BulkRoadmapRequest = z.infer<typeof BulkRoadmapRequestSchema>;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test --workspace @pathforge/api -- bulk-roadmap-schema`
Expected: PASS — all 7 cases.

- [ ] **Step 5: Run the full backend test suite (no regressions)**

Run: `npm test --workspace @pathforge/api`
Expected: PASS — `bulk-roadmap-schema`, `roadmap-helpers`, `health`.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/roadmap.ts apps/api/test/bulk-roadmap-schema.test.ts
git commit -m "feat(shared): BulkRoadmapRequestSchema for LLM import"
```

---

## Task 2: Backend `POST /api/roadmaps/bulk` endpoint

**Files:**
- Modify: `apps/api/src/routes/roadmaps.ts`

The handler validates with `BulkRoadmapRequestSchema.safeParse`, returns 400 with the structured error list on failure, and on success creates the entire tree in one `RoadmapModel.create` call. Mongoose auto-generates `_id` for embedded subdocs because the schemas use the default `{ _id: true }`.

- [ ] **Step 1: Add the import for `BulkRoadmapRequestSchema`**

Modify the import block at the top of `apps/api/src/routes/roadmaps.ts` (around lines 3-11) to include the new schema:

```typescript
import {
  CreateRoadmapRequestSchema,
  UpdateRoadmapRequestSchema,
  CreateMilestoneRequestSchema,
  UpdateMilestoneRequestSchema,
  CreateStepRequestSchema,
  UpdateStepRequestSchema,
  ReorderRequestSchema,
  BulkRoadmapRequestSchema,
} from '@pathforge/shared';
```

- [ ] **Step 2: Add the route handler**

Append the following handler inside the `roadmapsRoutes` function, immediately after the existing `POST /api/roadmaps` block (around line 50) and before `GET /api/roadmaps/:id`:

```typescript
  // POST /api/roadmaps/bulk
  app.post('/api/roadmaps/bulk', { preHandler: [app.authenticate] }, async (request, reply) => {
    const parsed = BulkRoadmapRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        errors: parsed.error.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      });
    }
    const userId = request.user!._id;
    const doc = await RoadmapModel.create({
      userId,
      title: parsed.data.roadmap.title,
      description: parsed.data.roadmap.description,
      deadline: parsed.data.roadmap.deadline,
      archived: false,
      milestones: parsed.data.milestones.map((m) => ({
        title: m.title,
        description: m.description,
        deadline: m.deadline,
        steps: (m.steps ?? []).map((s) => ({
          title: s.title,
          links: s.links ?? [],
          completed: false,
        })),
      })),
    });
    return reply.code(201).send(serializeRoadmap(doc.toObject() as never));
  });
```

- [ ] **Step 3: Boot the API locally and smoke-test the endpoint**

Run: `docker compose up -d` (or `npm run dev --workspace @pathforge/api` if Mongo is already running).

In a second terminal, log in to grab a session cookie and POST a payload. Use a known dev user id (any 24-char hex from `GET /api/auth/dev-users`):

```bash
# 1. Get dev user IDs
curl -s http://localhost:4000/api/auth/dev-users | head

# 2. Log in as the first one
curl -s -c /tmp/pf.cookies -X POST http://localhost:4000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"userId":"<paste-user-id-here>"}'

# 3. Bulk create
curl -s -b /tmp/pf.cookies -X POST http://localhost:4000/api/roadmaps/bulk \
  -H 'Content-Type: application/json' \
  -d '{
    "roadmap": {"title": "Smoke test"},
    "milestones": [
      {"title": "M1", "steps": [{"title": "S1"}, {"title": "S2"}]}
    ]
  }' | head
```

Expected: 201 JSON with `_id`, `userId`, `milestones[0]._id`, `milestones[0].steps[0]._id` all populated as 24-char hex strings.

- [ ] **Step 4: Smoke-test the validation error response**

```bash
curl -s -b /tmp/pf.cookies -X POST http://localhost:4000/api/roadmaps/bulk \
  -H 'Content-Type: application/json' \
  -d '{"roadmap": {}, "milestones": []}'
```

Expected: 400 with body `{"errors":[{"path":"roadmap.title","message":"Required"},{"path":"milestones","message":"Array must contain at least 1 element(s)"}]}` (order may vary).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/roadmaps.ts
git commit -m "feat(api): POST /api/roadmaps/bulk for LLM import"
```

---

## Task 3: LLM prompt library

**Files:**
- Create: `apps/web/src/lib/llm-prompt.ts`

This module owns the prompt template, the JSON schema example string, and the interpolation function. Keeping it as a plain module (no React, no hooks) makes it trivially callable from anywhere and easy to swap out later.

- [ ] **Step 1: Create the file**

Create `apps/web/src/lib/llm-prompt.ts`:

```typescript
/**
 * Inline JSON example shown to the LLM and copyable on its own as a fallback
 * for users who want to build a custom prompt around the schema.
 */
export const JSON_TEMPLATE = `{
  "roadmap": {
    "title": "...",
    "description": "...",
    "deadline": "YYYY-MM-DD"
  },
  "milestones": [
    {
      "title": "...",
      "description": "...",
      "deadline": "YYYY-MM-DD",
      "steps": [
        {
          "title": "...",
          "links": [{ "url": "https://...", "label": "..." }]
        }
      ]
    }
  ]
}`;

const GOAL_PLACEHOLDER =
  '[Describe your goal here, e.g. "Learn Rust in 3 months while building a CLI tool"]';

/**
 * Builds the full LLM prompt with the user's goal interpolated. When the goal
 * is empty the placeholder remains, so the prompt is always copy-able (even if
 * the result will be generic). Callers should still gate the "Copy prompt"
 * button on a non-empty goal — the empty fallback exists for the preview only.
 */
export function buildPrompt(goal: string): string {
  const goalLine = goal.length > 0 ? goal : GOAL_PLACEHOLDER;
  return `You are helping me plan a roadmap. Generate a JSON object that strictly matches the schema below. Do not include any explanation, prose, or markdown fences — output only the raw JSON object so I can paste it into an app.

Goal: ${goalLine}

Rules:
- Every roadmap, milestone, and step must have a non-empty title.
- Use 3-6 milestones unless the goal explicitly warrants more.
- Each milestone should have 3-8 concrete, actionable steps.
- Set deadlines (ISO format: YYYY-MM-DD) only when they would be meaningful and realistic.
- Include 1-3 reference links per step when you can cite an authoritative source. Skip otherwise.
- Output must be valid JSON. Do not wrap it in \`\`\`json fences.

Schema:
${JSON_TEMPLATE}`;
}
```

- [ ] **Step 2: Type-check the file**

Run: `npm run build --workspace @pathforge/web 2>&1 | head -40`
Expected: build succeeds (or fails only on unrelated files — we haven't wired this in yet).

If `build` is slow, alternatively run `npx tsc --noEmit -p apps/web/tsconfig.json` from the repo root.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/llm-prompt.ts
git commit -m "feat(web): LLM prompt template and goal interpolation helper"
```

---

## Task 4: Clipboard helper

**Files:**
- Create: `apps/web/src/lib/clipboard.ts`

Wraps `navigator.clipboard.writeText` with a hidden-textarea + `document.execCommand('copy')` fallback for non-secure contexts. Returns a boolean so callers can decide whether to show "Copied!" or an error toast.

- [ ] **Step 1: Create the file**

Create `apps/web/src/lib/clipboard.ts`:

```typescript
/**
 * Copies `text` to the clipboard. Tries the modern async API first, then
 * falls back to a hidden-textarea + `document.execCommand('copy')` for
 * non-secure contexts (older browsers, http:// production deploys without
 * TLS). Returns `true` if either path succeeded, `false` if both failed.
 */
export async function copyText(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fall through to legacy path
    }
  }

  if (typeof document === 'undefined') return false;

  const el = document.createElement('textarea');
  el.value = text;
  el.setAttribute('readonly', '');
  el.style.position = 'fixed';
  el.style.top = '-1000px';
  el.style.left = '-1000px';
  document.body.appendChild(el);
  el.select();
  try {
    const ok = document.execCommand('copy');
    return ok;
  } catch {
    return false;
  } finally {
    document.body.removeChild(el);
  }
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit -p apps/web/tsconfig.json`
Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/clipboard.ts
git commit -m "feat(web): copyText helper with execCommand fallback"
```

---

## Task 5: `useBulkCreateRoadmap` hook

**Files:**
- Modify: `apps/web/src/hooks/useRoadmaps.ts`

Adds a TanStack mutation hook that posts to `/roadmaps/bulk`, invalidates the list cache on success, and navigates to the new detail page. Reuses the existing `showMutationError` helper for non-validation errors.

- [ ] **Step 1: Add the `BulkRoadmapRequest` type import**

Modify the import block at the top of `apps/web/src/hooks/useRoadmaps.ts` (currently lines 2-10) to add `BulkRoadmapRequest`:

```typescript
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
```

- [ ] **Step 2: Add the hook**

Append the following at the bottom of `apps/web/src/hooks/useRoadmaps.ts` (after `useReorderSteps`):

```typescript
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: LIST_PREFIX });
    },
  });
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit -p apps/web/tsconfig.json`
Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/hooks/useRoadmaps.ts
git commit -m "feat(web): useBulkCreateRoadmap mutation hook"
```

---

## Task 6: `ImportPromptPanel` component

**Files:**
- Create: `apps/web/src/components/roadmaps/ImportPromptPanel.tsx`

The top half of the dialog. Form-driven: user types a goal, the prompt textarea updates live via `useMemo`, the "Copy prompt" button is disabled until the goal is non-empty and shows a "Copied!" pulse for 2s on success.

- [ ] **Step 1: Create the file**

Create `apps/web/src/components/roadmaps/ImportPromptPanel.tsx`:

```typescript
import { useEffect, useMemo, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { buildPrompt, JSON_TEMPLATE } from '@/lib/llm-prompt';
import { copyText } from '@/lib/clipboard';
import { toast } from 'sonner';

export function ImportPromptPanel() {
  const [goal, setGoal] = useState('');
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [copiedTemplate, setCopiedTemplate] = useState(false);
  const promptTimer = useRef<number | null>(null);
  const templateTimer = useRef<number | null>(null);

  const interpolatedPrompt = useMemo(() => buildPrompt(goal.trim()), [goal]);
  const canCopyPrompt = goal.trim().length > 0;

  useEffect(() => {
    return () => {
      if (promptTimer.current) window.clearTimeout(promptTimer.current);
      if (templateTimer.current) window.clearTimeout(templateTimer.current);
    };
  }, []);

  const handleCopyPrompt = async () => {
    if (!canCopyPrompt) return;
    const ok = await copyText(interpolatedPrompt);
    if (!ok) {
      toast.error('Could not copy — select and copy manually.');
      return;
    }
    setCopiedPrompt(true);
    if (promptTimer.current) window.clearTimeout(promptTimer.current);
    promptTimer.current = window.setTimeout(() => setCopiedPrompt(false), 2000);
  };

  const handleCopyTemplate = async () => {
    const ok = await copyText(JSON_TEMPLATE);
    if (!ok) {
      toast.error('Could not copy — select and copy manually.');
      return;
    }
    setCopiedTemplate(true);
    if (templateTimer.current) window.clearTimeout(templateTimer.current);
    templateTimer.current = window.setTimeout(() => setCopiedTemplate(false), 2000);
  };

  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">1. Generate the prompt</h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Describe your goal, then copy the prompt and paste it into any LLM.
        </p>
      </div>

      <div>
        <label
          htmlFor="import-goal"
          className="block text-xs font-medium text-slate-700 mb-1.5"
        >
          What's the goal?
        </label>
        <Input
          id="import-goal"
          autoFocus
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          placeholder='e.g. Learn Rust in 3 months while building a CLI tool'
        />
      </div>

      <div>
        <label
          htmlFor="import-prompt"
          className="block text-xs font-medium text-slate-700 mb-1.5"
        >
          Prompt to send <span className="text-slate-400 font-normal">(updates as you type)</span>
        </label>
        <Textarea
          id="import-prompt"
          readOnly
          rows={10}
          value={interpolatedPrompt}
          aria-label="Generated LLM prompt"
          className="font-mono text-xs"
        />
      </div>

      <div className="flex items-center gap-2" role="status" aria-live="polite">
        <Button
          onClick={handleCopyPrompt}
          disabled={!canCopyPrompt}
          className="bg-brand text-white hover:bg-brand-hover"
        >
          {copiedPrompt ? 'Copied!' : 'Copy prompt'}
        </Button>
        <Button variant="ghost" onClick={handleCopyTemplate}>
          {copiedTemplate ? 'Copied!' : 'Copy template only'}
        </Button>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit -p apps/web/tsconfig.json`
Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/roadmaps/ImportPromptPanel.tsx
git commit -m "feat(web): ImportPromptPanel for LLM prompt generation"
```

---

## Task 7: `ImportPastePanel` component

**Files:**
- Create: `apps/web/src/components/roadmaps/ImportPastePanel.tsx`

The bottom half: textarea + file upload + live validation summary + Cancel/Create buttons. Validation runs on every change, visual feedback debounced 250ms. On valid submit, calls the parent's `onSubmit(parsed)` and lets the parent handle navigation/closing.

- [ ] **Step 1: Create the file**

Create `apps/web/src/components/roadmaps/ImportPastePanel.tsx`:

```typescript
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
    (n, m) => n + (m.steps?.length ?? 0),
    0
  );
  const linkCount = result.data.milestones.reduce(
    (n, m) =>
      n + (m.steps ?? []).reduce((k, s) => k + (s.links?.length ?? 0), 0),
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
        <h3 className="text-sm font-semibold text-slate-900">2. Paste the result</h3>
        <p className="text-xs text-slate-500 mt-0.5">
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

      <div role="alert" aria-live="polite" className="min-h-[1.25rem]">
        {showState.kind === 'empty' && (
          <p className="text-xs text-slate-500">Paste JSON or upload a file.</p>
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
            {serverErrors.map((e) => (
              <li key={`${e.path}-${e.message}`}>
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
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit -p apps/web/tsconfig.json`
Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/roadmaps/ImportPastePanel.tsx
git commit -m "feat(web): ImportPastePanel with live validation and file upload"
```

---

## Task 8: `ImportRoadmapDialog` shell

**Files:**
- Create: `apps/web/src/components/roadmaps/ImportRoadmapDialog.tsx`

Owns the dialog open state plumbing, the mutation, server-error surfacing, navigation on success. Both panels stack vertically inside `DialogContent`. On every dialog open, server errors and panel state reset (the panels reset their own state via `key` prop tied to `open`).

- [ ] **Step 1: Create the file**

Create `apps/web/src/components/roadmaps/ImportRoadmapDialog.tsx`:

```typescript
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { isAxiosError } from 'axios';
import type { BulkRoadmapRequest } from '@pathforge/shared';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ImportPromptPanel } from './ImportPromptPanel';
import { ImportPastePanel } from './ImportPastePanel';
import { useBulkCreateRoadmap } from '@/hooks/useRoadmaps';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ServerError = { path: string; message: string };

export function ImportRoadmapDialog({ open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const bulkCreate = useBulkCreateRoadmap();
  const [serverErrors, setServerErrors] = useState<ServerError[] | null>(null);

  useEffect(() => {
    if (!open) setServerErrors(null);
  }, [open]);

  const handleSubmit = async (data: BulkRoadmapRequest) => {
    setServerErrors(null);
    try {
      const fresh = await bulkCreate.mutateAsync(data);
      onOpenChange(false);
      navigate(`/roadmaps/${fresh._id}`);
    } catch (err) {
      if (isAxiosError(err) && err.response?.status === 400 && err.response.data?.errors) {
        setServerErrors(err.response.data.errors as ServerError[]);
        return;
      }
      toast.error("Couldn't create roadmap. Try again.", {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold tracking-tight">
            Import from LLM
          </DialogTitle>
          <DialogDescription>
            Generate a prompt, paste the response, and we'll build the roadmap.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6 mt-4" key={open ? 'open' : 'closed'}>
          <ImportPromptPanel />
          <div className="border-t border-slate-200" />
          <ImportPastePanel
            pending={bulkCreate.isPending}
            serverErrors={serverErrors}
            onCancel={() => onOpenChange(false)}
            onSubmit={handleSubmit}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit -p apps/web/tsconfig.json`
Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/roadmaps/ImportRoadmapDialog.tsx
git commit -m "feat(web): ImportRoadmapDialog composing prompt and paste panels"
```

---

## Task 9: `ImportRoadmapButton` + header + page wiring

**Files:**
- Create: `apps/web/src/components/roadmaps/ImportRoadmapButton.tsx`
- Modify: `apps/web/src/components/roadmaps/ListPageHeader.tsx`
- Modify: `apps/web/src/pages/RoadmapsListPage.tsx`

- [ ] **Step 1: Create the button**

Create `apps/web/src/components/roadmaps/ImportRoadmapButton.tsx`:

```typescript
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  onClick: () => void;
}

export function ImportRoadmapButton({ onClick }: Props) {
  return (
    <Button variant="ghost" onClick={onClick} className="gap-1.5">
      <Sparkles className="h-4 w-4" />
      Import from LLM
    </Button>
  );
}
```

- [ ] **Step 2: Update `ListPageHeader.tsx`**

Replace the entire contents of `apps/web/src/components/roadmaps/ListPageHeader.tsx` with:

```typescript
import { Button } from '@/components/ui/button';
import { ImportRoadmapButton } from './ImportRoadmapButton';

interface Props {
  archived: boolean;
  onNewClick: () => void;
  onImportClick: () => void;
}

export function ListPageHeader({ archived, onNewClick, onImportClick }: Props) {
  return (
    <div className="flex items-end justify-between gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          {archived ? 'Archive' : 'Roadmaps'}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {archived ? 'Roadmaps you have set aside.' : 'Pursuits in motion.'}
        </p>
      </div>
      {!archived && (
        <div className="flex items-center gap-2">
          <ImportRoadmapButton onClick={onImportClick} />
          <Button
            onClick={onNewClick}
            className="bg-brand text-white hover:bg-brand-hover"
          >
            + New roadmap
          </Button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Update `RoadmapsListPage.tsx`**

Replace the entire contents of `apps/web/src/pages/RoadmapsListPage.tsx` with:

```typescript
import { useMemo, useState } from 'react';
import type { Roadmap } from '@pathforge/shared';
import { useRoadmaps } from '@/hooks/useRoadmaps';
import { ListPageHeader } from '@/components/roadmaps/ListPageHeader';
import { RoadmapsToolbar } from '@/components/roadmaps/RoadmapsToolbar';
import { RoadmapCardGrid } from '@/components/roadmaps/RoadmapCardGrid';
import { EmptyRoadmapsState } from '@/components/roadmaps/EmptyRoadmapsState';
import { NoResultsState } from '@/components/roadmaps/NoResultsState';
import { NewRoadmapDialog } from '@/components/roadmaps/NewRoadmapDialog';
import { ImportRoadmapDialog } from '@/components/roadmaps/ImportRoadmapDialog';

interface Props {
  archived?: boolean;
}

export default function RoadmapsListPage({ archived = false }: Props) {
  const { data, isPending } = useRoadmaps({ archived });
  const [query, setQuery] = useState('');
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  const filtered = useMemo<Roadmap[]>(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    if (q.length === 0) return data;
    return data.filter((r) => {
      if (r.title.toLowerCase().includes(q)) return true;
      if (r.description && r.description.toLowerCase().includes(q)) return true;
      if (r.milestones.some((m) => m.title.toLowerCase().includes(q))) return true;
      return false;
    });
  }, [data, query]);

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="container max-w-6xl py-10 px-6">
        <ListPageHeader
          archived={archived}
          onNewClick={() => setNewDialogOpen(true)}
          onImportClick={() => setImportDialogOpen(true)}
        />
        <RoadmapsToolbar query={query} onQueryChange={setQuery} archived={archived} />

        {isPending && <p className="mt-12 text-sm text-slate-500">Loading…</p>}
        {!isPending && data && data.length === 0 && (
          <EmptyRoadmapsState archived={archived} onNewClick={() => setNewDialogOpen(true)} />
        )}
        {!isPending && data && data.length > 0 && filtered.length === 0 && (
          <NoResultsState query={query} />
        )}
        {!isPending && filtered.length > 0 && <RoadmapCardGrid roadmaps={filtered} />}
      </div>

      <NewRoadmapDialog open={newDialogOpen} onOpenChange={setNewDialogOpen} />
      <ImportRoadmapDialog open={importDialogOpen} onOpenChange={setImportDialogOpen} />
    </main>
  );
}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit -p apps/web/tsconfig.json`
Expected: passes.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/roadmaps/ImportRoadmapButton.tsx apps/web/src/components/roadmaps/ListPageHeader.tsx apps/web/src/pages/RoadmapsListPage.tsx
git commit -m "feat(web): wire Import-from-LLM button into roadmaps list page"
```

---

## Task 10: End-to-end smoke test + changelog

**Files:**
- Modify: `docs/PROJECT.md`

- [ ] **Step 1: Start the stack**

Run: `docker compose up -d`
Open: `http://localhost:5173`
Log in as the first dev user.

- [ ] **Step 2: Manual E2E — happy path**

1. On `/roadmaps`, click **Import from LLM** in the header.
2. Type "Learn Rust in 3 months while building a CLI tool" into the goal input.
3. Verify the prompt textarea updates live to reflect the goal.
4. Click **Copy prompt** → button label flips to "Copied!" and reverts after ~2s.
5. Paste this valid JSON into the bottom textarea:

```json
{
  "roadmap": {
    "title": "Learn Rust",
    "description": "Three-month CLI track",
    "deadline": "2026-08-31"
  },
  "milestones": [
    {
      "title": "Foundation",
      "steps": [
        { "title": "Read chapter 1" },
        { "title": "Read chapter 2" },
        { "title": "Run cargo test", "links": [{ "url": "https://doc.rust-lang.org/book/", "label": "The Book" }] }
      ]
    },
    {
      "title": "Build a CLI",
      "steps": [
        { "title": "Pick a clap example" },
        { "title": "Wire argument parsing" }
      ]
    }
  ]
}
```

6. Verify the green summary appears: `✓ Ready — 2 milestones, 5 steps, 1 links.`
7. Click **Create roadmap**. Verify:
   - Dialog closes.
   - URL changes to `/roadmaps/<new-id>`.
   - Detail page shows the title, both milestones expanded with all steps, and the linked step has a clickable link chip.

- [ ] **Step 3: Manual E2E — invalid JSON path**

1. Reopen the import dialog.
2. Paste `not json {` into the bottom textarea.
3. Verify red message: `Couldn't parse JSON — check for trailing commas or missing quotes.`
4. Verify **Create roadmap** is disabled.

- [ ] **Step 4: Manual E2E — schema mismatch path**

1. Replace with `{"roadmap": {}, "milestones": []}`.
2. Verify the message reads `JSON does not match the schema.` and lists field errors like `roadmap.title: Required` and `milestones: Array must contain at least 1 element(s)`.
3. Verify **Create roadmap** stays disabled.

- [ ] **Step 5: Manual E2E — file upload path**

1. Save the valid JSON from step 2 to `/tmp/roadmap.json`.
2. In the dialog, click **Upload .json file** and select `/tmp/roadmap.json`.
3. Verify the textarea fills with the file contents and the green summary appears.
4. Click **Create roadmap**, verify redirect.

- [ ] **Step 6: Manual E2E — replace-confirm path**

1. Reopen the import dialog.
2. Type a few characters into the paste textarea.
3. Click **Upload .json file**, select `/tmp/roadmap.json`.
4. Verify a `window.confirm` appears asking `Replace pasted JSON?`. Accept it. Textarea is replaced.

- [ ] **Step 7: Manual E2E — javascript URL rejection**

1. Paste a payload with a `javascript:` URL in a step link:
   ```json
   { "roadmap": {"title": "Bad"}, "milestones": [{"title": "M", "steps": [{"title": "S", "links": [{"url": "javascript:alert(1)"}]}]}] }
   ```
2. Verify the schema validation message includes `milestones[0].steps[0].links[0].url`.
3. Verify the submit button stays disabled.

- [ ] **Step 8: Update `docs/PROJECT.md` changelog**

Append a new entry to the Changelog section of `docs/PROJECT.md`. The exact format follows the existing entries (read the file first to match style); the content of the new entry is:

```
- **2026-05-18 — LLM import**: `POST /api/roadmaps/bulk` accepts a full roadmap tree in one request; new "Import from LLM" dialog generates a prompt template from the user's goal and validates pasted/uploaded JSON against `BulkRoadmapRequestSchema` before creating the roadmap in a single atomic call.
```

- [ ] **Step 9: Commit**

```bash
git add docs/PROJECT.md
git commit -m "docs: PROJECT.md changelog — LLM import for roadmaps"
```

---

## Acceptance criteria

- [ ] `npm test --workspace @pathforge/api` passes (existing tests + 7 new schema tests).
- [ ] `npx tsc --noEmit -p apps/web/tsconfig.json` passes.
- [ ] All 7 manual E2E paths in Task 10 succeed.
- [ ] `POST /api/roadmaps/bulk` returns 201 with a serialized roadmap on success and 400 with `{ errors: [{path, message}] }` on Zod failure.
- [ ] Imported roadmaps appear in the roadmaps list immediately after creation.
- [ ] No regressions in the existing list page, detail page, or milestone/step flows.
