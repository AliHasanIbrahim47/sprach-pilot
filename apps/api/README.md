# API (`@sprachpilot/api`)

Express 5 + TypeScript ESM service for SprachPilot.

## Quick start

```bash
# from repo root
pnpm --filter @sprachpilot/api dev
```

Default listen address: `http://localhost:3001`

| Endpoint       | Purpose                                    |
| -------------- | ------------------------------------------ |
| `GET /healthz` | Liveness — process is up                   |
| `GET /readyz`  | Readiness — PostgreSQL and Redis reachable |

Optional env:

| Variable              | Default | Meaning                                    |
| --------------------- | ------- | ------------------------------------------ |
| `PORT`                | `3001`  | HTTP port                                  |
| `DATABASE_URL`        | unset   | PostgreSQL connection string for readiness |
| `REDIS_URL`           | unset   | Redis connection string for readiness      |
| `JSON_BODY_LIMIT`     | `1mb`   | Express JSON body limit                    |
| `SHUTDOWN_TIMEOUT_MS` | `25000` | Max wait for in-flight requests on SIGTERM |

Without `DATABASE_URL` / `REDIS_URL` (or when those services are down), `/readyz` returns **503** and lists the failing dependency in `failing`.

## Module structure

```
src/
  index.ts                 # process bootstrap (listen + graceful shutdown)
  app.ts                   # createApp() factory — used by tests without binding a port
  config.ts                # env → typed config
  container.ts             # composition root (manual DI)
  middleware/              # cross-cutting HTTP middleware
  infrastructure/          # adapters (DB/Redis readiness checks)
  modules/
    <feature>/
      <feature>.routes.ts       # Express router wiring
      <feature>.controller.ts   # HTTP ↔ DTO only
      <feature>.service.ts      # business logic (no Express)
      <feature>.repository.ts   # persistence / external I/O
      <feature>.schemas.ts      # types / Zod schemas (contracts grow in SP-006)
  server/
    graceful-shutdown.ts
tests/                     # Supertest integration tests
```

### Layering rules

1. **Controllers** — map HTTP to service calls; no business rules.
2. **Services** — domain logic; no `req`/`res`, no Prisma.
3. **Repositories** — only layer that talks to the database (Prisma arrives in SP-005) or other I/O.
4. **Composition root** (`container.ts`) — constructs the graph once; tests can override ports (e.g. fake readiness checks).

## Scripts

| Command                                | Description                |
| -------------------------------------- | -------------------------- |
| `pnpm --filter @sprachpilot/api dev`   | Hot reload via `tsx watch` |
| `pnpm --filter @sprachpilot/api build` | Emit `dist/`               |
| `pnpm --filter @sprachpilot/api start` | Run compiled server        |
| `pnpm --filter @sprachpilot/api test`  | Vitest unit + Supertest    |
| `pnpm --filter @sprachpilot/api lint`  | ESLint                     |

## Notes

- Error envelope and `/v1` versioning arrive in SP-009.
- Auth arrives in SP-012.
- Prefer injecting fakes at the container boundary for unit tests.
