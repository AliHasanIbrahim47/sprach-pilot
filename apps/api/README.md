# API (`@sprachpilot/api`)

Express 5 + TypeScript ESM service for SprachPilot.

## Quick start

```bash
# from repo root — copy apps/api/.env.example → apps/api/.env first
pnpm --filter @sprachpilot/api dev
```

Default listen address: `http://localhost:3001`

| Endpoint                 | Purpose                                                     |
| ------------------------ | ----------------------------------------------------------- |
| `GET /healthz`           | Liveness — process is up                                    |
| `GET /readyz`            | Readiness — PostgreSQL and Redis reachable                  |
| `POST /v1/auth/register` | Validates registration body (persistence in SP-012)         |
| `GET /openapi.json`      | OpenAPI 3.1 document (non-production, or `ENABLE_API_DOCS`) |
| `GET /docs`              | Scalar API reference UI                                     |

Config is validated with Zod at startup (see [`.env.example`](./.env.example)). `DATABASE_URL`, `REDIS_URL`, S3, and SMTP vars are required. Local `apps/api/.env` is loaded automatically; process env still wins.

When dependencies are down, `/readyz` returns **503** and lists the failing name in `failing`.

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
      <feature>.schemas.ts      # local ports / adapters; HTTP DTOs live in @sprachpilot/shared
  server/
    graceful-shutdown.ts
tests/                     # Supertest integration tests
```

### Layering rules

1. **Controllers** — map HTTP to service calls; no business rules.
2. **Services** — domain logic; no `req`/`res`, no Prisma.
3. **Repositories** — only layer that talks to the database (Prisma via `@sprachpilot/db`) or other I/O.
4. **Composition root** (`container.ts`) — constructs the graph once; tests can override ports (e.g. fake readiness checks).
5. **Contracts** — Zod schemas and OpenAPI live in `@sprachpilot/shared` (SP-006).

## Scripts

| Command                                | Description                |
| -------------------------------------- | -------------------------- |
| `pnpm --filter @sprachpilot/api dev`   | Hot reload via `tsx watch` |
| `pnpm --filter @sprachpilot/api build` | Emit `dist/`               |
| `pnpm --filter @sprachpilot/api start` | Run compiled server        |
| `pnpm --filter @sprachpilot/api test`  | Vitest unit + Supertest    |
| `pnpm --filter @sprachpilot/api lint`  | ESLint                     |

## Notes

- Errors use RFC 9457 Problem Details via central middleware (see [`docs/api/errors.md`](../../docs/api/errors.md)).
- Feature routes are under `/v1` and set `API-Version: 1`.
- Full registration/login: SP-012.
- Prefer injecting fakes at the container boundary for unit tests.
