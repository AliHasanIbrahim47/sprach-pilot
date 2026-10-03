# SprachPilot

Self-hosted German language-learning platform (dialogues, documents → flashcards, Sprachcafé matching).

How to contribute: [`CONTRIBUTING.md`](./CONTRIBUTING.md) · Conduct: [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md) · Decisions: [`docs/adr/`](./docs/adr/README.md)

## Quick start

```bash
# From the repository root
pnpm install
pnpm infra:up
pnpm db:migrate:deploy && pnpm db:seed
pnpm build
pnpm dev
```

| Command                             | What it does                                              |
| ----------------------------------- | --------------------------------------------------------- |
| `pnpm install`                      | Installs all workspace dependencies                       |
| `pnpm infra:up` / `down` / `reset`  | Start / stop / wipe local Docker backing services         |
| `pnpm build`                        | Builds apps and packages in topological order (Turborepo) |
| `pnpm dev`                          | Starts `web`, `api` and `worker` in parallel watch mode   |
| `pnpm typecheck`                    | Type-checks every workspace (`tsc --noEmit`)              |
| `pnpm lint`                         | Runs ESLint in every workspace                            |
| `pnpm format` / `pnpm format:check` | Format / check with Prettier                              |
| `pnpm test`                         | Runs tests in every workspace                             |
| `pnpm db:migrate:dev`               | Create/apply a Prisma migration (`packages/db`)           |
| `pnpm db:migrate:deploy`            | Apply pending migrations (CI/CD)                          |
| `pnpm db:seed`                      | Idempotent admin + demo learner seed                      |
| `pnpm db:studio` / `pnpm db:reset`  | Prisma Studio / reset DB                                  |
| `pnpm openapi:generate`             | Regenerate `packages/shared/openapi/openapi.json`         |

## Local infrastructure

Backing services run in Docker; apps stay on the host. Details: [`infra/README.md`](infra/README.md).

| Service                       | URL / port              | Dev credentials                                                          |
| ----------------------------- | ----------------------- | ------------------------------------------------------------------------ |
| PostgreSQL                    | `localhost:5432`        | `sprachpilot` / `sprachpilot`                                            |
| Redis                         | `localhost:6379`        | —                                                                        |
| S3 (SeaweedFS)                | `http://localhost:9000` | key `sprachpilot` / secret `sprachpilotsecret`, bucket `sprachpilot-dev` |
| Mailpit UI                    | http://localhost:8025   | SMTP `localhost:1025`                                                    |
| Grafana (optional profile)    | http://localhost:3002   | `admin` / `admin`                                                        |
| Prometheus (optional profile) | http://localhost:9090   | —                                                                        |

```bash
pnpm infra:up
pnpm infra:up -- --profile observability   # after pulling prometheus + grafana images
pnpm infra:reset                           # wipe volumes and recreate
```

Copy [`.env.example`](.env.example) (or the per-app examples under `apps/*/`) into `apps/api/.env`, `apps/worker/.env`, `apps/web/.env.local`, and `packages/db/.env`. Config is validated with Zod at startup (SP-008); missing required vars such as `DATABASE_URL` fail fast.

Database package details and expand/contract rules: [`packages/db/README.md`](packages/db/README.md).
Shared Zod contracts and OpenAPI: [`packages/shared/README.md`](packages/shared/README.md). Local API docs: `http://localhost:3001/docs`.

Commit messages use ticket headers and a bullet body (enforced by commitlint):

```text
[sp-006]: Short title here

- First change
- Second change
```

Husky runs lint-staged on pre-commit and commitlint on commit-msg.

## Repository layout

```
apps/
  web/       # Next.js App Router (skeleton until SP-004)
  api/       # Express API (skeleton until SP-003)
  worker/    # Background jobs
packages/
  shared/    # Shared TypeScript types and helpers
  db/        # Prisma schema, migrations, seed (@sprachpilot/db)
  config/    # Shared tsconfig and ESLint presets
infra/       # Docker, Kubernetes, CI/CD assets (not a pnpm workspace)
docs/        # ADRs, API catalogue (backlog is local-only)
```

Architecture Decision Records: [`docs/adr/README.md`](./docs/adr/README.md).

`apps/ml-service` (Python, uv) joins the repo in SP-086 and is not part of the pnpm workspace.

## Troubleshooting

### `pnpm build` / `pnpm dev` exit with `Exec format error` or code 137

pnpm 12’s Turbo-managed binary must be the native ELF. If install scripts were skipped, Turbo cannot spawn the placeholder. Re-run:

```bash
pnpm install
# or explicitly:
node ~/.local/share/pnpm/.tools/pnpm/12.6.0/node_modules/pnpm/install.js
```

The root `prepare` script runs `scripts/ensure-pnpm-native.mjs` to fix this automatically.

## Workspace packages

Apps and packages depend on each other with the `workspace:*` protocol, for example:

```json
{
  "dependencies": {
    "@sprachpilot/shared": "workspace:*"
  }
}
```
