# ADR-0002: Express + Next.js split instead of Next.js-only backend

- Status: Accepted
- Date: 2026-09-22
- Deciders: Tech Lead / Backend / Frontend
- Ticket: SP-003, SP-004

## Context

We need a long-lived HTTP API (auth, jobs, webhooks, OpenAPI), a separate worker process, and a React UI. Putting business logic only inside Next.js Route Handlers couples deploy cycles, complicates non-HTTP workers, and blurs API versioning.

## Decision

Split responsibilities:

- **`apps/api`**: Express 5 + TypeScript, layered modules (`routes` → `controller` → `service` → `repository`), URL versioning under `/v1`
- **`apps/web`**: Next.js App Router UI (RSC, Server Actions where appropriate); calls the API via a typed server client
- **`apps/worker`**: Background jobs sharing `@sprachpilot/db` and `@sprachpilot/shared`

Next.js is not the system of record for domain APIs.

## Alternatives considered

| Option | Why not |
| --- | --- |
| Next.js-only (Route Handlers + server actions as API) | Harder for workers/webhooks; weaker OpenAPI story; couples UI deploys to API |
| NestJS | More framework weight than we want for an Express-shaped team |
| Remix / custom Node server for UI | Next.js App Router is the chosen frontend platform |
| tRPC end-to-end | Product requires REST + OpenAPI for external/tooling consumers |

## Consequences

- Contracts live in `@sprachpilot/shared` (Zod + OpenAPI); both sides import them.
- CORS, cookies, and auth cookies must be designed across origins/ports in local and prod.
- Feature work usually touches `shared` schemas, then API module, then web UI.
- Health probes stay on the API process (`/healthz`, `/readyz`), not only on Next.
