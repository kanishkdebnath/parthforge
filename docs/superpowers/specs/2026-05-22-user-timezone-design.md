# User Timezone Setting — Design

*2026-05-22*

## Purpose

Add a per-user `timezone` preference that becomes the source of truth for any server-side logic that needs to resolve the user's "today" — currently the demo-user journal seed, in the future likely cron jobs, summary emails, or report windows. Users set it from the profile page; if absent, existing fallbacks (the login-time `clientToday`, then UTC) still apply.

This builds directly on the Journal feature's `clientToday` plumbing (added in `feat/journal`). The browser-sent `clientToday` was a useful first signal but assumes a live client at "today computation" time. A stored `user.timezone` removes that coupling.

## Goals

- An optional `timezone` field on the User model carrying an IANA name (e.g., `America/Los_Angeles`).
- A `PATCH /api/auth/me` endpoint that accepts `{ timezone: string | null }` for setting or clearing the field.
- A "Timezone" section on the Profile page with a filterable combobox + Save/Clear actions.
- A server-side helper `userTodayLocal(tz?, clientToday?)` that resolves the user's "today" in this order: stored timezone → login-time `clientToday` → UTC.
- The demo-login hook switches to the helper, so subsequent demo resets honor the user's stored timezone preference.

## Non-Goals

- Editing other user fields (`name`, `email`, `avatarUrl`) — separate work if desired.
- Auto-detecting and silently persisting the browser's timezone on first login. The profile page can *suggest* the detected zone, but persistence is an explicit user action.
- A user-visible "what timezone is the server in" indicator.
- Per-feature timezone overrides (each feature inherits `user.timezone` or falls through).
- Frontend test infrastructure.
- A migration step to back-fill `timezone` on existing users. The field is genuinely optional.

## Architecture

```
                   PATCH /api/auth/me  { timezone }
                              │
                              ▼
              ┌──────────────────────────────┐
              │ validate via Intl…           │
              │ (string -> $set | null -> $unset)
              └─────────────┬────────────────┘
                            ▼
                       User document
                            │
                            ▼
        ┌── any server-side "what is today for this user?" ──┐
        │   userTodayLocal(user.timezone, clientToday)       │
        │     ├─ user.timezone via Intl.DateTimeFormat       │
        │     ├─ clientToday from login body                 │
        │     └─ UTC today (final fallback)                  │
        └────────────────────────────────────────────────────┘
                            │
                            ▼
             demo-reset seed (today / journal / future)
```

## Load-Bearing Rules Respected

- **Shared keystone:** `timezone` lives on `UserSchema` (already in `@pathforge/shared`); `UpdateMeRequestSchema` is added to the same module. Both API and web import from there.
- **Auth shape stable:** no changes to login/logout/session-cookie flow. The new PATCH endpoint reuses the existing `authenticate` preHandler. `/me` payload grows by one optional field — additive.
- **`<RequireAuth>`** gates the profile route as before.
- **Single source of truth for "today" resolution:** centralized in `userTodayLocal`; consumers (demo login route, future cron) call the helper instead of reimplementing the lookup order.

## Data Model

### Shared — `packages/shared/src/user.ts`

```ts
export const UserSchema = z.object({
  _id: z.string(),
  email: z.string().email(),
  name: z.string().min(1),
  avatarUrl: z.string().url().optional(),
  googleId: z.string().optional(),
  isDemoUser: z.boolean().optional(),
  timezone: z.string().min(1).max(80).optional(),   // new
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const UpdateMeRequestSchema = z.object({
  // Null clears it; undefined leaves it alone. String must be an IANA tz
  // (server validates via Intl.DateTimeFormat).
  timezone: z.string().min(1).max(80).nullable().optional(),
});
export type UpdateMeRequest = z.infer<typeof UpdateMeRequestSchema>;
```

### Mongoose — `apps/api/src/models/User.ts`

```ts
const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    avatarUrl: String,
    googleId: { type: String, index: true, sparse: true },
    isDemoUser: { type: Boolean, default: false },
    timezone: { type: String },                       // new
  },
  { timestamps: true }
);
```

### Auth plugin — `apps/api/src/plugins/auth.ts`

The `request.user = { … }` block adds:

```ts
timezone: user.timezone ?? undefined,
```

## Server Helper — `apps/api/src/lib/user-time.ts`

```ts
/** Returns YYYY-MM-DD for the user's "today" in preference order:
 *  1. user.timezone (via Intl.DateTimeFormat)
 *  2. clientToday (login-body fallback, already validated YYYY-MM-DD)
 *  3. UTC today */
export function userTodayLocal(tz?: string, clientToday?: string): string {
  if (tz) {
    try {
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: tz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).formatToParts(new Date());
      const y = parts.find((p) => p.type === 'year')?.value;
      const m = parts.find((p) => p.type === 'month')?.value;
      const d = parts.find((p) => p.type === 'day')?.value;
      if (y && m && d) return `${y}-${m}-${d}`;
    } catch {
      // invalid tz — fall through
    }
  }
  if (clientToday) return clientToday;
  return new Date().toISOString().slice(0, 10);
}

/** Whether a string is a valid IANA timezone. */
export function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
```

The `'en-CA'` locale is the cheapest way to get an unambiguous YYYY-MM-DD layout from `formatToParts`. The locale choice is irrelevant beyond that — the parts are read by `type`, not by string position.

## API Surface

| Method | Path | Body | Auth | Returns |
|---|---|---|---|---|
| `PATCH` | `/api/auth/me` | `UpdateMeRequest` | required | Updated `User` |

Behavior:
- `timezone: string` → validate via `isValidTimezone`. If invalid → `400 { error: 'Invalid timezone' }`. Else `$set: { timezone }`.
- `timezone: null` → `$unset: { timezone: '' }`.
- `timezone: undefined` (omitted) → no-op write that returns the current user. Edge case but cheap.
- 401 without session cookie.

### Login route — `apps/api/src/routes/auth.ts`

Existing demo-reset call changes from:

```ts
await resetDemoData(user._id, parsed.data.clientToday);
```

to:

```ts
const anchorDate = userTodayLocal(user.timezone, parsed.data.clientToday);
await resetDemoData(user._id, anchorDate);
```

## Frontend

### Hook — `apps/web/src/hooks/useAuth.ts`

```ts
export function useUpdateMe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: UpdateMeRequest): Promise<User> => {
      const res = await api.patch<User>('/auth/me', body);
      return res.data;
    },
    onSuccess: (fresh) => qc.setQueryData(['auth', 'me'], fresh),
    onError: (err) => toast.error(extractMessage(err) ?? 'Could not save profile'),
  });
}
```

### Profile page — `apps/web/src/pages/Profile.tsx`

Adds a second card below the existing user-info card:

```
┌─ Timezone ──────────────────────────────────┐
│ Your timezone determines what "today" means │
│ across the app (journal entries, demo data, │
│ future scheduled reminders).                │
│                                             │
│ [ America/Los_Angeles  ▾ ]                  │
│ Detected: America/New_York                  │
│                                             │
│                  [ Save ]  [ Clear ]        │
└─────────────────────────────────────────────┘
```

### Component — `apps/web/src/components/profile/TimezoneCard.tsx`

- Owns the draft `selected: string | null` state, seeded from `me.timezone`.
- Combobox options from `Intl.supportedValuesOf('timeZone')`. If the browser doesn't expose `supportedValuesOf` (Safari < 17), fall back to a curated list of common zones from a constant.
- Filterable via type-to-search (shadcn `Command` primitive if present; else native `<select>` with `optgroup` by region).
- "Detected" label uses `Intl.DateTimeFormat().resolvedOptions().timeZone` as a hint — not auto-saved.
- "Save" enabled when `selected !== me.timezone`.
- "Clear" visible only when `me.timezone` is set; sends `{ timezone: null }`.

## Demo-Reset Behavior Matrix

| `user.timezone` | login `clientToday` | result |
|---|---|---|
| `'America/Los_Angeles'` | any | LA local YYYY-MM-DD |
| unset | `'2026-05-22'` | `'2026-05-22'` |
| unset | absent | UTC today |
| invalid string | `'2026-05-22'` | `'2026-05-22'` (silent fallback) |
| invalid string | absent | UTC today |

## Error Handling

| Scenario | Behavior |
|---|---|
| PATCH without cookie | 401 |
| PATCH with body that fails Zod | 400 + `details` |
| PATCH with semantically invalid timezone | 400 `{ error: 'Invalid timezone' }` |
| PATCH targeting deleted user (race) | 404 |
| Save under network failure | Mutation error → toast; draft state preserved |

## Testing

`apps/api/test/user-time.test.ts` — unit tests for `userTodayLocal` and `isValidTimezone`:
- Returns tz-local date when `tz` is valid (boundary case: just after UTC midnight while LA is still on the previous day).
- Falls through to `clientToday` when `tz` is missing or `isValidTimezone(tz) === false`.
- Falls through to UTC when both are absent.
- `isValidTimezone` accepts `'UTC'`, `'America/Los_Angeles'`, `'Asia/Kolkata'`; rejects `'Not/A_Zone'`, empty string.

`apps/api/test/auth.test.ts` (new) — integration tests for the PATCH endpoint:
- 401 without cookie.
- 400 with `{ timezone: 'Not/A_Zone' }`.
- Happy path: PATCH `{ timezone: 'America/Los_Angeles' }` → subsequent GET `/me` reflects the value.
- Clear path: PATCH `{ timezone: null }` → `/me` returns user without `timezone`.

`apps/api/test/user-schema.test.ts` — Zod parse smoke for `UpdateMeRequestSchema`:
- Accepts `{ timezone: 'America/Los_Angeles' }`, `{ timezone: null }`, `{}`.
- Rejects `{ timezone: '' }`, `{ timezone: 'x'.repeat(81) }`.

Frontend testing — deferred.

## Open Questions

None.
