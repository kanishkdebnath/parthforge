# Pathforge — Project Document

Living document for the Pathforge project. Updated as scope evolves. The current section that drives implementation is **Current Milestone**.

---

## Vision

Pathforge is a personal dashboard for managing the structured pursuit of life goals. Three core feature areas, planned but not all built at once:

1. **Roadmaps** — goals broken into ordered milestone checklists.
2. **Resources** — a library of saved links and videos.
3. **Job applications** — an application tracker.

Resources and job applications can optionally link to a roadmap or milestone, but each library stands on its own.

The app is a web-based dashboard, desktop-first. Multi-user (public signup) is the long-term shape; the first milestone uses a stub login to keep iteration fast.

---

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend framework | React 18 + Vite + TypeScript | Largest ecosystem, fast HMR, type safety |
| UI components | Tailwind CSS + shadcn/ui | Copy-paste components, full ownership, no lock-in |
| Forms | React Hook Form + Zod | Standard pairing, validation reused from shared schemas |
| Server state | TanStack Query | Caching, invalidation, mutation lifecycle |
| Routing | React Router | Mature, well-known |
| HTTP client | Axios (`withCredentials: true`) | Cookie auth needs credentials forwarding |
| Backend framework | Fastify + TypeScript | Fast, good DX, built-in schema validation |
| DB & ODM | MongoDB 7 + Mongoose | Schemas, validation, hooks; matches "store everything in Mongo" goal |
| Validation | Zod (shared with frontend) | Single source of truth for shapes |
| Session/cookies | `@fastify/cookie` | Signed httpOnly cookies for session id |
| Logger | Pino (Fastify default) | Structured JSON logs |
| Monorepo | npm workspaces | Share Zod schemas + types between web and api |
| Local dev | Docker Compose | One-command bring-up of mongo + api + web |

**Deferred decisions:** production hosting (likely Render/Railway/Fly.io or a small VPS), error tracking, analytics.

---

## Repository Layout

```
pathforge/
├── apps/
│   ├── web/                # React + Vite frontend
│   │   ├── src/
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   └── package.json
│   └── api/                # Fastify backend
│       ├── src/
│       ├── tsconfig.json
│       └── package.json
├── packages/
│   └── shared/             # Zod schemas + inferred TS types
│       ├── src/
│       └── package.json
├── docker/
│   ├── api.Dockerfile
│   └── web.Dockerfile
├── docs/
│   └── PROJECT.md          # this file
├── docker-compose.yml
├── .env.example
├── package.json            # workspaces config
├── tsconfig.base.json
└── README.md
```

The **shared** package is the architectural keystone: a Zod schema (e.g. `UserSchema`) is defined once and imported by both the API (for request validation and Mongoose model alignment) and the web app (for form validation and types).

---

## Data Model (Long-Term)

Five collections planned. Only `users` is implemented in the current milestone.

### `users` *(implemented in current milestone)*
```ts
{
  _id: ObjectId,
  email: string,            // unique
  name: string,
  avatarUrl?: string,
  googleId?: string,        // populated in Phase 2 when OAuth is added
  createdAt: Date,
  updatedAt: Date,
}
```

### `roadmaps` *(deferred)*
Milestones embedded — small, ordered, always loaded together.
```ts
{
  _id, userId, title, description, status: 'active'|'paused'|'done'|'archived',
  milestones: [{ _id, title, notes?, completed: boolean, completedAt?, order: number }],
  createdAt, updatedAt,
}
```

### `resources` *(deferred)*
```ts
{
  _id, userId, type: 'link'|'video', url, title, description?, tags: string[],
  links: { roadmapId?, milestoneId? },
  createdAt, updatedAt,
}
```
Compound indexes planned: `{ userId, tags }`, `{ userId, "links.roadmapId" }`.

### `jobApplications` *(deferred)*
```ts
{
  _id, userId, company, role, jobUrl?,
  status: 'saved'|'applied'|'interview'|'offer'|'rejected'|'withdrawn',
  appliedAt?, notes?,
  contacts: [{ name, role, email? }],
  links: { roadmapId? },
  createdAt, updatedAt,
}
```

### `tags` *(probably never)*
Derived from `resources.tags` until aggregation pressure forces a dedicated collection.

**Rule that holds for every collection:** carries `userId`, every query filters by it, compound indexes start with `userId`.

---

## Auth Strategy

Phased, but the *shape* never changes — only the login step swaps out.

### Phase 1 — Stub login (current milestone)
- `GET /api/auth/dev-users` returns the seeded dev users. Only available when `NODE_ENV === 'development'`.
- `POST /api/auth/login` body `{ userId }` → server sets a signed httpOnly session cookie carrying that userId.
- `POST /api/auth/logout` → clears cookie.
- `GET /api/auth/me` → returns current user from cookie, or 401.
- Auth middleware reads the cookie on every request and attaches `req.user` (or 401s for protected routes).

### Phase 2 — Google OAuth (later)
- Replace `POST /api/auth/login` with `GET /api/auth/google` + `GET /api/auth/google/callback`.
- Callback upserts a user by `googleId`, sets the same session cookie.
- `/me`, `/logout`, frontend route guards, navbar — all unchanged.
- The dev-users endpoint stays available only in development.
- Note: the demo-reset hook in the login handler (`if user.isDemoUser → resetDemoData`) is part of the login route. When Phase 2 replaces `POST /api/auth/login`, port that hook to the OAuth callback or drop it if demo users won't exist in production.

### Phase 3 — Email/password (maybe, only if needed)
- Adds `passwordHash` to the user model, plus `/signup` and password-based `/login`.
- Coexists with Google OAuth.

---

## API Surface — Current Milestone

| Method | Path | Purpose | Auth |
|---|---|---|---|
| GET | `/api/health` | Liveness probe | none |
| GET | `/api/auth/dev-users` | List seeded dev users (dev only) | none |
| POST | `/api/auth/login` | Set session cookie for given `userId` | none |
| POST | `/api/auth/logout` | Clear session cookie | required |
| GET | `/api/auth/me` | Current user | required |

Future endpoints (roadmaps, resources, jobs) get added under `/api/roadmaps`, `/api/resources`, `/api/jobs` and all require auth.

---

## Frontend — Current Milestone

**Routes**
- `/login` — public. Dropdown populated from `/api/auth/dev-users`, "Continue" button → `POST /api/auth/login` → redirect to `/`.
- `/` — protected. Placeholder dashboard ("Welcome, {name}").
- `/profile` — protected. Shows current user's email, name, avatar.

**Navbar (visible on protected routes only)**
- Left: "Pathforge" wordmark, links to `/`.
- Right: avatar + name dropdown with "Profile" → `/profile`, "Logout" → calls logout endpoint and redirects to `/login`.

**Auth flow**
- TanStack Query owns the `/me` query, cached as `['auth', 'me']`.
- A `<RequireAuth>` wrapper around protected routes redirects to `/login` on 401.
- On successful login or logout, invalidate `['auth', 'me']` so the navbar updates without a full reload.

---

## Local Development

`docker compose up` brings up three services:

- **mongo** — MongoDB 7, exposes 27017, volume-mounted for persistence
- **api** — Fastify with `tsx watch` for hot reload, exposes 4000
- **web** — Vite dev server, exposes 5173, proxies `/api/*` to the api service

The API runs a seed on first boot if the `users` collection is empty: creates 2–3 dev users (e.g. *Ada Lovelace*, *Alan Turing*, *Grace Hopper*).

Environment variables live in `.env` (gitignored). `.env.example` documents the keys:
- `MONGO_URL`
- `SESSION_SECRET`
- `NODE_ENV`
- `FRONTEND_ORIGIN` (for CORS)

---

## Current Milestone — v0: Walking Skeleton

**Definition of done:** `docker compose up` from a clean clone → open `http://localhost:5173` → pick a dev user → land on dashboard with name in the navbar → visit `/profile` → log out → back at `/login`.

**In scope**
- Monorepo scaffold (npm workspaces, TypeScript base config, shared package)
- Fastify API with the 5 endpoints above, Mongoose user model, dev seed, cookie session, auth middleware
- React app with login page, dashboard placeholder, profile page, navbar, auth-aware routing
- shadcn/ui set up with a small starter set (Button, Avatar, DropdownMenu, Select, Card)
- Tailwind configured
- Docker Compose for the three services + Dockerfiles for api and web
- `.env.example`, root `README.md` with run instructions
- One smoke test on the API: `/api/health` returns 200. End-to-end browser tests are explicitly deferred to a later milestone.

**Out of scope**
- Roadmaps, resources, job applications
- Google OAuth, password auth, signup
- Production deployment, HTTPS, rate limiting, security hardening beyond signed cookies + CORS + helmet defaults
- Comprehensive testing

**Future-proofing already baked in**
- `userId` will exist on every future model; auth middleware already provides `req.user`
- Only `/api/auth/login` changes when swapping to Google OAuth; the rest of the stack stays put
- Dev-users endpoint and login dropdown self-hide outside development via `NODE_ENV`

---

## Changelog

- *2026-05-16* — Initial project doc. v0 walking-skeleton scope defined.
- *2026-05-17* — v0 walking skeleton implemented: monorepo scaffold, shared `UserSchema`, Fastify API with stub auth (signed cookies), React/Tailwind/shadcn web app, Docker Compose bring-up. Acceptance flow passes from `docker compose down -v` → `docker compose up` → seeded login → `/profile` → logout.
- *2026-05-17* — Roadmaps backend shipped: shared Zod schemas, embedded Mongoose model, 13 REST endpoints under `/api/roadmaps`. Frontend implementation pending via frontend-design pass.
- *2026-05-17* — Roadmaps frontend shipped: Editorial Manuscript aesthetic (Fraunces display + slate/amber/lime palette + numbered milestones + drop caps + paper grain); list and detail pages; drag-and-drop reorder for milestones and steps via @dnd-kit; optimistic step toggle and reorder; inline editing throughout; client-side search across title, description, and milestone titles.
- *2026-05-18* — Roadmaps frontend redesigned to Stripe/Apple aesthetic — Inter throughout (no serif), sky/emerald/red palette (no amber/lime/rose), two-column sidebar detail layout with always-visible Edit/Archive/Delete actions, always-expanded milestone cards with chevron-collapse, hybrid edit pattern (inline for checkbox + title rename, modal for multi-field). Backend and hooks unchanged.
- *2026-05-18* — LLM import: `POST /api/roadmaps/bulk` accepts a full roadmap tree in one atomic request (validated by new `BulkRoadmapRequestSchema` in `@pathforge/shared` with http/https-only links); new "Import from LLM" header button opens a two-panel dialog that interpolates a prompt template from the user's goal (live preview, copy buttons) and validates pasted/uploaded JSON inline before creating the roadmap and navigating to its detail page.
- *2026-05-21* — Demo user + onboarding tour: added `isDemoUser` flag on the User schema, a fourth seeded dev user `Pathfinder Demo` whose roadmaps + jobs are wiped and reseeded from a canonical showcase fixture (3 roadmaps, 5 jobs spanning the application funnel) on every login, and a side-panel `TourPanel` that auto-opens for the demo user and walks through 5 Roadmaps steps then 4 Jobs steps. Tour state is in-memory only.
