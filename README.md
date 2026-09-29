# SprachPilot

Self-hosted German language-learning platform (dialogues, documents → flashcards, Sprachcafé matching).

## Quick start

```bash
# From the repository root
pnpm install
pnpm build
pnpm dev
```

| Command                             | What it does                                              |
| ----------------------------------- | --------------------------------------------------------- |
| `pnpm install`                      | Installs all workspace dependencies                       |
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
docs/        # Backlog, ADRs, runbooks
```

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
