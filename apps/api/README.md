# API (`@sprachpilot/api`)

Express 5 + TypeScript ESM service for SprachPilot.

## Quick start

```bash
# from repo root — copy apps/api/.env.example → apps/api/.env first
pnpm --filter @sprachpilot/api dev
```

Default listen address: `http://localhost:3001`

| Endpoint                        | Purpose                                                                                   |
| ------------------------------- | ----------------------------------------------------------------------------------------- |
| `GET /healthz`                  | Liveness — process is up                                                                  |
| `GET /readyz`                   | Readiness — PostgreSQL and Redis reachable                                                |
| `POST /v1/auth/register`        | Create an account (identical response if the email exists)                                |
| `POST /v1/auth/login`           | Verify email and password                                                                 |
| `POST /v1/auth/logout`          | Revoke the current session and clear auth cookies                                         |
| `POST /v1/auth/refresh`         | Rotate the refresh token; reuse revokes the session family                                |
| `GET /v1/auth/verify`           | Consume a single-use email verification token                                             |
| `POST /v1/auth/verify/resend`   | Queue another verification email (same response if the address is unknown)                |
| `POST /v1/auth/password/forgot` | Queue a password-reset email (same response if the address is unknown)                    |
| `POST /v1/auth/password/reset`  | Set a new password and revoke every session                                               |
| `GET /v1/auth/me`               | Current account, including whether the email is verified                                  |
| `GET /v1/auth/sessions`         | List the caller's active device sessions                                                  |
| `DELETE /v1/auth/sessions/:id`  | Revoke one device session                                                                 |
| `GET /.well-known/jwks.json`    | Public Ed25519 keys for access-token verification                                         |
| `GET /metrics`                  | Prometheus counters, including `auth_refresh_total` and `auth_token_reuse_detected_total` |
| `GET /openapi.json`             | OpenAPI 3.1 document (non-production, or `ENABLE_API_DOCS`)                               |
| `GET /docs`                     | Scalar API reference UI                                                                   |

Config is validated with Zod at startup (see [`.env.example`](./.env.example)). `DATABASE_URL`, `REDIS_URL`, S3, SMTP, and `IP_HASH_SECRET` are required. Local `apps/api/.env` is loaded automatically; process env still wins.

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
- Prefer injecting fakes at the container boundary for unit tests.

## Authentication (SP-012)

Passwords are hashed with argon2id in `packages/db/src/password.ts`:

| Parameter   | Value              | Notes                     |
| ----------- | ------------------ | ------------------------- |
| algorithm   | Argon2id           | OWASP recommendation      |
| memoryCost  | 19456 KiB (19 MiB) | Minimum required by NFR-1 |
| timeCost    | 2                  | Passes                    |
| parallelism | 1                  | Single lane               |

Registration stores two consent rows (`terms`, `privacy`), version `2026-10-03`, the acceptance time, and an HMAC-SHA256 of the client IP (`IP_HASH_SECRET`). Raw IPs and passwords are not written to application logs.

A bundled NCSC common-password list (length ≥ 10) rejects passwords such as `password123` without calling an external API. Login failures share one message. After 5 failures in 15 minutes for an email and IP pair, the next attempt returns **429** with `Retry-After`. The handler does not sleep the request.

## Sessions (SP-013)

Login, refresh, and logout set `sp_access` (EdDSA JWT, 15 minutes) and `sp_refresh` (opaque, 30 days) as `httpOnly`, `Secure`, `SameSite=Lax` cookies. The JSON body never contains either token. Refresh tokens are stored as an HMAC (`JWT_REFRESH_PEPPER`). Presenting a refresh token that was already rotated returns **401**, revokes that session family, and increments `auth_token_reuse_detected_total`. Access-token checks use the JWKS public key and do not hit the database. See [`docs/security/session-tokens.md`](../../docs/security/session-tokens.md).
