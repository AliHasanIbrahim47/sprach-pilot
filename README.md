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

Commit messages use [Conventional Commits](https://www.conventionalcommits.org/) with optional scopes: `api`, `web`, `worker`, `db`, `infra`, `docs`, `shared`, `config`, `repo`. Husky runs lint-staged on pre-commit and commitlint on commit-msg.

## Repository layout

```
apps/
  web/       # Next.js App Router (skeleton until SP-004)
  api/       # Express API (skeleton until SP-003)
  worker/    # Background jobs
packages/
  shared/    # Shared TypeScript types and helpers
  db/        # Prisma data layer (arrives in SP-005)
  config/    # Shared tsconfig and ESLint presets
infra/       # Docker, Kubernetes, CI/CD assets (not a pnpm workspace)
docs/        # Backlog, ADRs, runbooks
```

`apps/ml-service` (Python, uv) joins the repo in SP-086 and is not part of the pnpm workspace.

## Workspace packages

Apps and packages depend on each other with the `workspace:*` protocol, for example:

```json
{
  "dependencies": {
    "@sprachpilot/shared": "workspace:*"
  }
}
```
