# Roadmaps LLM Import — Design Spec

**Date:** 2026-05-18
**Status:** Design approved, ready for implementation plan
**Related:** [2026-05-17-roadmaps-feature-design.md](./2026-05-17-roadmaps-feature-design.md), [2026-05-18-roadmaps-redesign.md](./2026-05-18-roadmaps-redesign.md)

## Goal

Let a user generate a full roadmap (title + description + milestones + steps + links) by asking an LLM for JSON, then pasting or uploading that JSON into the app. Replaces the slow click-by-click flow for users who already know their goal and want scaffolding fast.

## User flow

1. On the roadmaps list page, user clicks **Import from LLM** (a secondary header button next to `+ New roadmap`).
2. A dialog opens with two stacked panels:
   - **1. Generate the prompt** — form-driven. User types their goal, an interpolated prompt updates live in a read-only textarea, user clicks **Copy prompt**.
   - **2. Paste the result** — user pastes the LLM's JSON output (or uploads a `.json` file), the app validates client-side, then `Create roadmap` submits to the backend.
3. On success, dialog closes and the user lands on `/roadmaps/<new-id>` (the standard detail page).

No intermediate preview/diff screen. The validation summary in step 2 is the preview.

---

## Section 1 — JSON schema

The schema mirrors the existing single-item shapes from `@pathforge/shared` so the backend can reuse `MilestoneSchema`, `StepSchema`, and `LinkSchema` directly. New combined schema:

```ts
// packages/shared/src/roadmap.ts (additions)

export const BulkRoadmapRequestSchema = z.object({
  roadmap: z.object({
    title: z.string().min(1).max(200),
    description: z.string().max(2000).optional(),
    deadline: z.coerce.date().optional(),
  }),
  milestones: z.array(z.object({
    title: z.string().min(1).max(200),
    description: z.string().max(2000).optional(),
    deadline: z.coerce.date().optional(),
    steps: z.array(z.object({
      title: z.string().min(1).max(200),
      links: z.array(LinkSchema).optional().default([]),
    })).default([]),
  })).min(1),
});

export type BulkRoadmapRequest = z.infer<typeof BulkRoadmapRequestSchema>;
```

Notes:
- `z.coerce.date()` so the LLM can emit `"2026-08-01"` and it becomes a `Date` after parse.
- `LinkSchema` already enforces `url.protocol in {http:, https:}` — reused as-is.
- Steps default to `[]` so a milestone can be empty (matches existing add-milestone-first behavior).
- No `archived` / `_id` / `userId` / timestamps in the input. The server fills those.

## Section 2 — Backend

**Endpoint:** `POST /api/roadmaps/bulk`

**Location:** `apps/api/src/routes/roadmaps.ts` (added alongside the existing 13 handlers).

**Behavior:**

```ts
fastify.post('/bulk', async (req, reply) => {
  const userId = req.user!.id;
  const parsed = BulkRoadmapRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return reply.code(400).send({
      errors: parsed.error.issues.map(i => ({
        path: i.path.join('.'),
        message: i.message,
      })),
    });
  }

  const { roadmap, milestones } = parsed.data;
  const doc = await RoadmapModel.create({
    _id: new Types.ObjectId().toString(),
    userId,
    title: roadmap.title,
    description: roadmap.description,
    deadline: roadmap.deadline,
    archived: false,
    milestones: milestones.map(m => ({
      _id: new Types.ObjectId().toString(),
      title: m.title,
      description: m.description,
      deadline: m.deadline,
      completedAt: null,
      steps: (m.steps ?? []).map(s => ({
        _id: new Types.ObjectId().toString(),
        title: s.title,
        completed: false,
        links: s.links ?? [],
      })),
    })),
  });

  return reply.code(201).send(serializeRoadmap(doc.toObject()));
});
```

- Single atomic `RoadmapModel.create` — if anything fails, nothing is persisted.
- `completedAt` always null on import (no completed steps possible at creation).
- Reuses `serializeRoadmap` so the response shape exactly matches the existing detail endpoint.
- Error response: `400 { errors: [{path, message}] }` — structured so the frontend can render line-level messages. The frontend Zod check should have caught this, but server is the source of truth.

**Tests** (`apps/api/test/roadmap-helpers.test.ts` or a sibling file):
- Valid full payload → 201 with serialized roadmap, `userId` matches, IDs are 24-char hex.
- Invalid: missing roadmap title → 400, `errors[0].path === 'roadmap.title'`.
- Invalid: empty milestones array → 400.
- Invalid: bad URL protocol (`javascript:`) → 400.
- Cross-tenant: requesting with no session → 401.

## Section 3 — Frontend

### New files

- `apps/web/src/lib/llm-prompt.ts` — constants and helpers:
  ```ts
  export const JSON_TEMPLATE = `{
    "roadmap": { "title": "...", "description": "...", "deadline": "YYYY-MM-DD" },
    "milestones": [
      {
        "title": "...",
        "description": "...",
        "deadline": "YYYY-MM-DD",
        "steps": [
          { "title": "...", "links": [{ "url": "https://...", "label": "..." }] }
        ]
      }
    ]
  }`;

  export const buildPrompt = (goal: string): string => `You are helping me plan a roadmap. Generate a JSON object that strictly matches the schema below. Do not include any explanation, prose, or markdown fences — output only the raw JSON object so I can paste it into an app.

Goal: ${goal || '[Describe your goal here, e.g. "Learn Rust in 3 months while building a CLI tool"]'}

Rules:
- Every roadmap, milestone, and step must have a non-empty title.
- Use 3-6 milestones unless the goal explicitly warrants more.
- Each milestone should have 3-8 concrete, actionable steps.
- Set deadlines (ISO format: YYYY-MM-DD) only when they would be meaningful and realistic.
- Include 1-3 reference links per step when you can cite an authoritative source. Skip otherwise.
- Output must be valid JSON. Do not wrap it in \`\`\`json fences.

Schema:
${JSON_TEMPLATE}`;
  ```

- `apps/web/src/lib/clipboard.ts` — `copyText(s: string): Promise<boolean>` with `navigator.clipboard.writeText` and a hidden-textarea `document.execCommand('copy')` fallback.

- `apps/web/src/components/roadmaps/ImportRoadmapButton.tsx` — ghost-variant button with `Sparkles` icon, opens the dialog.

- `apps/web/src/components/roadmaps/ImportRoadmapDialog.tsx` — shadcn `<Dialog>` shell; renders the two panels stacked; owns the `goal` and `pastedJson` state.

- `apps/web/src/components/roadmaps/ImportPromptPanel.tsx` — the form panel:
  ```tsx
  const [goal, setGoal] = useState('');
  const interpolatedPrompt = useMemo(() => buildPrompt(goal.trim()), [goal]);
  const canCopyPrompt = goal.trim().length > 0;
  ```
  - `<Label>` + `<Input placeholder="e.g. Learn Rust in 3 months while building a CLI tool">` bound to `goal`.
  - `<Textarea rows={10} readOnly value={interpolatedPrompt} aria-label="Generated LLM prompt">`.
  - Two buttons: **Copy prompt** (primary `bg-brand`, disabled when `!canCopyPrompt`, shows "Copied!" for 2s) and **Copy template only** (ghost, always enabled, copies `JSON_TEMPLATE`).

- `apps/web/src/components/roadmaps/ImportPastePanel.tsx` — the validate-and-submit panel:
  - `<Textarea rows={12}>` for paste, plus an upload button (`<input type="file" accept=".json,application/json">` styled as a button).
  - Validation runs on every change, debounced 250ms for visual feedback only.
  - Three states rendered above the action row:
    - empty → neutral `"Paste JSON or upload a file."`
    - invalid → red message with `JSON.parse` error or up to 5 Zod field errors (`milestones[2].steps[0].title: required`, capped with `…and N more`)
    - valid → green check + `"Ready — 5 milestones, 23 steps, 2 links."`
  - Footer: **Cancel** (ghost, closes dialog) + **Create roadmap** (primary, disabled unless valid or while pending).

### Hook addition

`apps/web/src/hooks/useRoadmaps.ts` gains `useBulkCreateRoadmap`:
```ts
export const useBulkCreateRoadmap = () => {
  const qc = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: (payload: BulkRoadmapRequest) =>
      api.post<Roadmap>('/roadmaps/bulk', payload).then(r => r.data),
    onSuccess: (roadmap) => {
      qc.invalidateQueries({ queryKey: ['roadmaps', 'list'] });
      navigate(`/roadmaps/${roadmap.id}`);
    },
    onError: (err) => showMutationError(err, "Couldn't create roadmap."),
  });
};
```

### Header integration

`apps/web/src/components/roadmaps/ListPageHeader.tsx` — render `<ImportRoadmapButton />` to the left of the existing `+ New roadmap` primary. Ghost variant so the primary stays the visual focus.

## Section 4 — Error handling & edge cases

### Validation timing in the paste panel

Validate on every change. Debounce visual feedback by 250ms so typing doesn't flash red. Three states:

- **Empty** — neutral hint: `"Paste JSON or upload a file."`
- **Invalid** — red border on textarea + message above the action row. For `JSON.parse` failure: `"Couldn't parse JSON — check for trailing commas or missing quotes."` For Zod failure: up to 5 field errors as `roadmap.title: required`, `milestones[2].steps[0].title: required` (paths joined with `.`/`[i]`), capped with `…and N more`.
- **Valid** — green check + summary `"Ready — 5 milestones, 23 steps, 2 links."` Submit enables.

No live preview/diff — the validation summary is the preview.

### File upload guardrails

- `accept=".json,application/json"` on the input.
- Max 256KB — if larger, toast `"File too large (max 256KB)."` and don't read.
- On `FileReader.onerror`, toast `"Couldn't read file."`.
- Successful read replaces textarea contents; if textarea is already non-empty, confirm via `window.confirm("Replace pasted JSON?")` first.

### Backend error surfacing

`useBulkCreateRoadmap.onError` handles two shapes:
1. **400 with `{ errors: [{path, message}] }`** — render inside the dialog under the paste panel. Don't close the dialog.
2. **Any other error** — `toast.error("Couldn't create roadmap. Try again.")`, dialog stays open.

Never close the dialog on error. The pasted content is expensive to recover.

### Clipboard fallback

`copyText(s)` in `apps/web/src/lib/clipboard.ts` tries `navigator.clipboard.writeText`, falls back to a hidden `<textarea>` + `document.execCommand('copy')`. On both failing, toast `"Couldn't copy — select and copy manually."` and select the source textarea's contents.

### Accessibility

- Both panels wrapped in `<form>` with `<Label>` for each control.
- Read-only prompt textarea: `aria-label="Generated LLM prompt"` + `readOnly` (not `disabled`, so users can select-all).
- Copy buttons: `aria-live="polite"` region announces "Copied" on state flip.
- Dialog uses shadcn `<Dialog>` (focus trap, Esc to close, restored focus — already accessible).
- Validation error message: `role="alert"`.

### Cancel & dirty-state

Cancel just closes the dialog — no "discard changes?" prompt. Reopening starts empty (state is local to dialog mount).

### Edge cases worth naming

- **Empty milestones array** — schema requires `min(1)`. Empty steps array is allowed.
- **Duplicate step titles within a milestone** — allowed (mirrors free-form behavior).
- **Deadline in the past** — allowed, no warning (user may be back-dating).
- **Step links** — `LinkSchema` already enforces http/https.
- **Hugely long titles** — `max(200)` cap matches existing fields; surfaces as a Zod error.
- **Trailing whitespace / BOM in pasted JSON** — `.trim()` the textarea value before parse.

---

## Files touched

**New:**
- `apps/web/src/lib/llm-prompt.ts`
- `apps/web/src/lib/clipboard.ts`
- `apps/web/src/components/roadmaps/ImportRoadmapButton.tsx`
- `apps/web/src/components/roadmaps/ImportRoadmapDialog.tsx`
- `apps/web/src/components/roadmaps/ImportPromptPanel.tsx`
- `apps/web/src/components/roadmaps/ImportPastePanel.tsx`

**Modified:**
- `packages/shared/src/roadmap.ts` — export `BulkRoadmapRequestSchema` + `BulkRoadmapRequest`.
- `packages/shared/src/index.ts` — re-export.
- `apps/api/src/routes/roadmaps.ts` — add `POST /bulk` handler.
- `apps/api/test/roadmap-helpers.test.ts` (or new sibling) — bulk-create tests.
- `apps/web/src/hooks/useRoadmaps.ts` — add `useBulkCreateRoadmap`.
- `apps/web/src/components/roadmaps/ListPageHeader.tsx` — add the Import button.

## Out of scope

- Editing the imported roadmap pre-submit (use the existing detail page after import).
- Saving generated prompts for reuse.
- Direct LLM API integration (no API keys, no provider lock-in — copy/paste keeps it model-agnostic).
- Append-to-existing-roadmap imports (single-shot, creates a new roadmap only).
- Multiple-roadmap bulk imports.
