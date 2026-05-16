# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Source of Truth

[docs/PROJECT.md](docs/PROJECT.md) is the living project document — vision, tech stack, data model, auth phasing, API surface, and the current milestone. Read it before proposing changes to architecture or scope. Update its **Changelog** section when scope shifts.

## Current State

v0 walking-skeleton complete (see [docs/PROJECT.md](docs/PROJECT.md) Changelog). Stub auth + dashboard + profile + logout work end-to-end under `docker compose up`. Roadmaps, resources, and job applications are not yet built — they are the next milestones. When asked to implement those, follow the data-model sketches in PROJECT.md and the load-bearing rules below.

## Architecture — Load-Bearing Rules

These are the decisions that future code must respect; they are easy to violate accidentally if you only read one file.

- **`packages/shared` is the architectural keystone.** Every domain shape is a Zod schema defined once in `packages/shared/src`, then imported by both `apps/api` (request validation, Mongoose model alignment) and `apps/web` (React Hook Form validation, inferred TS types). Do not duplicate a shape in either app — add it to `shared` and import it.

- **Every collection except `users` carries `userId`.** Every query filters by `userId`. Every compound index starts with `userId`. This is the multi-tenant boundary; do not add a model or query that breaks it.

- **Auth shape is stable across phases — only the login endpoint swaps.** The session is always a signed httpOnly cookie carrying a userId; middleware always attaches `req.user`; `/api/auth/me`, `/api/auth/logout`, frontend route guards, and the navbar are unchanged from Phase 1 → Phase 2 (Google OAuth) → Phase 3 (email/password). When adding OAuth later, replace `POST /api/auth/login`; do not touch the rest.

- **Dev-only endpoints gate on `NODE_ENV === 'development'`.** `GET /api/auth/dev-users` and the login-page dropdown must self-hide outside development. New dev affordances follow the same gate.

- **Axios on the web app uses `withCredentials: true`.** The session cookie won't be sent otherwise. Any new HTTP client setup must preserve this.

- **TanStack Query owns auth state under the key `['auth', 'me']`.** Invalidate this key on login and logout so the navbar updates without a reload. Don't mirror auth state into a separate store.

- **`<RequireAuth>` wraps protected routes and redirects to `/login` on 401.** Route guarding goes through this wrapper, not ad-hoc checks inside pages.

## Local Development

Per PROJECT.md, `docker compose up` is the intended single-command bring-up: `mongo` (27017, volume-persisted), `api` (Fastify + `tsx watch`, port 4000), `web` (Vite dev server, port 5173, proxies `/api/*` to the api service). The API seeds 2–3 dev users on first boot if `users` is empty.

Env vars live in `.env` (gitignored); keys documented in `.env.example`: `MONGO_URL`, `SESSION_SECRET`, `NODE_ENV`, `FRONTEND_ORIGIN`.

Commands (npm workspaces) are not yet defined in code — once scaffolded, expect the usual `npm run dev`, `npm run build`, `npm test` driven from the root, with workspace-scoped variants for `apps/api`, `apps/web`, and `packages/shared`.

## Scope Discipline

PROJECT.md's v0 milestone is intentionally narrow: auth + walking-skeleton UI only. Roadmaps, resources, and job applications are explicitly out of scope for v0 even though their data models are sketched. Don't pre-build deferred features; do leave room for them (the `userId`-on-everything rule and the stable auth shape are how that room is preserved).
