# Pathforge

Personal dashboard for managing structured pursuit of life goals. See [docs/PROJECT.md](docs/PROJECT.md) for full scope and [docs/superpowers/plans/](docs/superpowers/plans/) for implementation plans.

## Quick start

```bash
cp .env.example .env
# edit .env: set SESSION_SECRET to `openssl rand -hex 32`
docker compose up
```

Then open http://localhost:5173 and pick a seeded dev user.

## Layout

- `apps/api` — Fastify + Mongoose backend (port 4000)
- `apps/web` — React + Vite frontend (port 5173)
- `packages/shared` — Zod schemas + inferred types (imported by both apps)
