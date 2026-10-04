# @sprachpilot/db

Shared Prisma schema, generated client, migrations and seed for SprachPilot.

API and worker import the singleton from this package:

```ts
import { prisma, UserRole } from "@sprachpilot/db";
```

## Prerequisites

- PostgreSQL 16 from local compose (`pnpm infra:up`, SP-007)
- `DATABASE_URL` and `DIRECT_URL` (copy `.env.example` → `.env`)

## Scripts (from repo root)

| Command                  | Purpose                                                        |
| ------------------------ | -------------------------------------------------------------- |
| `pnpm db:migrate:dev`    | Create and apply a migration from schema changes (interactive) |
| `pnpm db:migrate:deploy` | Apply pending migrations non-interactively (CI/CD)             |
| `pnpm db:seed`           | Upsert admin + demo learner (idempotent)                       |
| `pnpm db:studio`         | Open Prisma Studio                                             |
| `pnpm db:reset`          | Drop, re-migrate and re-seed (local only)                      |
| `pnpm db:drift-check`    | Fail if `schema.prisma` drifts from `prisma/migrations`        |

Inside the package the same scripts exist without the root proxy (`pnpm --filter @sprachpilot/db db:migrate:dev`).

## Seed accounts

| Email                       | Password            | Role      |
| --------------------------- | ------------------- | --------- |
| `admin@sprachpilot.local`   | `ChangeMe!Admin1`   | `admin`   |
| `learner@sprachpilot.local` | `ChangeMe!Learner1` | `learner` |

Passwords are hashed with argon2id (`memoryCost` 19456 KiB, `timeCost` 2, `parallelism` 1) via `src/password.ts`. Re-running seed updates those rows; it never creates duplicates.

`consent_records` stores Terms and Privacy acceptance (policy, version, timestamp, IP hash) captured at registration.

`sessions` stores refresh-token families (SP-013). The raw refresh token is never written; `refresh_token_hash` is an HMAC. `family_id` stays stable across rotations and is the access-token `sid`. A reused refresh token sets `revoked_at` on every row in that family.

## Roles and connections

| Role                | Used by                                     | Privileges                                             |
| ------------------- | ------------------------------------------- | ------------------------------------------------------ |
| App (`sprachpilot`) | API, worker                                 | DML on app tables only — **no** superuser / `CREATEDB` |
| Migrator            | `prisma migrate deploy` (K8s Job in SP-063) | DDL + migrate history tables; still not superuser      |

Locally both URLs point at the same compose user. In staging/production set:

- `DATABASE_URL` → pooled app credentials (PgBouncer / pooler)
- `DIRECT_URL` → migrator credentials on the primary (required by Prisma Migrate)

## Migration guidelines (expand / contract)

Migrations are **forward-only**. Never edit a migration after it has been merged to `main`.

Schema changes must stay backwards-compatible with the previously deployed app version for **one release** (expand/contract):

1. **Expand** — add nullable columns, new tables, new indexes (`CREATE INDEX CONCURRENTLY` via a custom SQL migration for large tables). Deploy app code that writes both old and new shapes if needed.
2. **Migrate data** — backfill in a follow-up migration or job while both shapes work.
3. **Contract** — remove old columns/tables only after the previous app version is gone.

Breaking renames: add the new column → dual-write → backfill → switch reads → drop the old column across releases.

CI must run `pnpm db:drift-check` (wired in SP-064) so PRs that change `schema.prisma` without a matching migration fail.

## PII annotations

Columns holding personal data carry a `/// @pii` doc comment in `schema.prisma`. SP-019 uses these markers for export and deletion registries.

## Layout

```
packages/db/
  prisma/
    schema.prisma
    migrations/
    seed.ts
  src/
    client.ts    # singleton + pool / query logging
    index.ts     # public exports
  README.md
```
