# ADR-0003: PostgreSQL + Prisma

- Status: Accepted
- Date: 2026-09-24
- Deciders: Tech Lead / Backend
- Ticket: SP-005

## Context

We need a relational store for users, learning content metadata, events, and audit logs; strong migrations; and TypeScript-friendly access from API and worker. Future geo queries (PostGIS) must not force a rewrite.

## Decision

- **PostgreSQL 16** as the primary database (local Compose; CloudNativePG later)
- **Prisma** in `packages/db` (`@sprachpilot/db`) for schema, migrations, client, and seed
- Expand/contract migration rules; separate app vs migrator credentials in non-local envs (`DATABASE_URL` / `DIRECT_URL`)
- Prefer UUID identifiers (v7 where applicable)

## Alternatives considered

| Option | Why not |
| --- | --- |
| MongoDB / document DB | Relational integrity and SQL analytics fit the domain better |
| Drizzle / Kysely | Prisma's migration + studio workflow is the team default |
| TypeORM / Sequelize | Weaker TypeScript DX for greenfield TS |
| Raw `pg` only | Too little structure for a multi-app monorepo |

## Consequences

- Schema changes go through Prisma migrations reviewed in PRs.
- API/worker import the shared client; no second ORM.
- Prisma error codes are mapped in the API error middleware (e.g. `P2002` → 409).
- PostGIS and advanced SQL can still be used via raw queries when needed (SP-047).
