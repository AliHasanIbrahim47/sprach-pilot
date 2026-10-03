# ADR-0001: Monorepo with pnpm and Turborepo

- Status: Accepted
- Date: 2026-09-20
- Deciders: Tech Lead
- Ticket: SP-001

## Context

SprachPilot needs a web app, HTTP API, background worker, shared contracts, and a data layer. Separate repos would slow shared types, consistent tooling, and atomic cross-cutting changes. We need fast local installs and selective task caching in CI.

## Decision

Use a **single Git repository** with:

- **pnpm workspaces** for packages (`apps/*`, `packages/*`)
- **Turborepo** for `build` / `lint` / `test` / `dev` orchestration and caching
- Shared presets in `@sprachpilot/config` (TypeScript, ESLint, Prettier)
- `infra/` outside the pnpm workspace (Compose, later K8s / Jenkins)

## Alternatives considered

| Option | Why not |
| --- | --- |
| Yarn / npm workspaces | pnpm's content-addressable store and strict linking fit our size and CI better |
| Nx | Heavier; Turborepo covers our pipeline needs |
| Polyrepo (one repo per app) | Shared Zod/Prisma would need publishing or git submodules |
| Bazel | Overkill for a TypeScript product team |

## Consequences

- Apps depend on packages via `workspace:*`.
- Root scripts (`pnpm build`, `pnpm test`, …) are the default entry points.
- New apps/packages must register in `pnpm-workspace.yaml` and Turbo tasks.
- Python ML service (SP-086) stays out of the pnpm workspace and uses `uv`.
