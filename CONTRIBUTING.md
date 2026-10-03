# Contributing to SprachPilot

Thanks for helping. This guide is enough to run the stack, make a change, and open a correctly formatted PR.

## Prerequisites

- Node.js matching the repo (see root `package.json` / CI)
- [pnpm](https://pnpm.io) 12.x (see `packageManager` field)
- Docker or Podman for local infra (`pnpm infra:up`)

## First-time setup

```bash
pnpm install
pnpm infra:up
cp .env.example apps/api/.env          # also apps/worker/.env, apps/web/.env.local, packages/db/.env
pnpm db:migrate:deploy && pnpm db:seed
pnpm build
pnpm dev
```

| Surface | URL                                          |
| ------- | -------------------------------------------- |
| Web     | http://localhost:3000                        |
| API     | http://localhost:3001 (`/docs` when enabled) |
| Mailpit | http://localhost:8025                        |

More detail: root [`README.md`](./README.md), [`infra/README.md`](./infra/README.md).

## Branching (trunk-based)

- Default branch: `main` (always deployable).
- Work on **short-lived** branches: `sp-NNN-short-topic` or `feat/sp-NNN-…`.
- Rebase or merge `main` often; open a PR promptly (prefer &lt; a few days of work).
- No long-lived release branches for day-to-day features.

## Commits

Commitlint enforces ticket headers and a blank line before the body:

```text
[sp-011]: Add ADRs and CONTRIBUTING guide

- Document six foundation ADRs and an index
- Add CONTRIBUTING and Code of Conduct
```

- One logical change per commit when practical.
- Do not commit secrets (`.env` is gitignored; use `.env.example`).

Husky runs **lint-staged** (ESLint + Prettier) on pre-commit and **commitlint** on commit-msg.

## Pull requests

1. Ensure locally: `pnpm lint && pnpm typecheck && pnpm test`
2. Open a PR against `main` with:
   - Title referencing the ticket (`[sp-011]: …` or clear equivalent)
   - Summary of **why** + what changed
   - Test plan (commands you ran / what to click)
3. Keep the PR focused; split unrelated work.
4. Address review comments with new commits (or squash at merge per team preference).

### Review checklist (authors and reviewers)

- [ ] Matches the ticket / ADR; no silent architecture changes
- [ ] Typesafe; no new `any`
- [ ] User-facing web strings go through i18n message files (`apps/web/messages`)
- [ ] API errors use domain errors / Problem Details (see [`docs/api/errors.md`](./docs/api/errors.md))
- [ ] Migrations are expand/contract safe if schema changes
- [ ] Tests cover the new behaviour (unit and/or integration)
- [ ] Docs updated when behaviour or contribution rules change

## Testing

| Command                                     | Scope                          |
| ------------------------------------------- | ------------------------------ |
| `pnpm test`                                 | All workspaces (Turbo)         |
| `pnpm --filter @sprachpilot/api test`       | API Vitest + Supertest         |
| `pnpm --filter @sprachpilot/web test`       | Web Vitest (+ `i18n:check`)    |
| `pnpm --filter @sprachpilot/web i18n:check` | Locale key parity vs `en.json` |

Prefer fakes at the API composition root (`createContainer` overrides) over hitting real Redis/DB in unit tests. Integration tests may use Compose services when needed.

## Database migrations

Schema lives in [`packages/db`](./packages/db/README.md).

```bash
# After editing schema.prisma
pnpm db:migrate:dev          # name the migration; apply locally
pnpm db:drift-check          # CI-style drift detection
pnpm db:migrate:deploy       # apply pending (CI / prod job)
```

Follow expand/contract: additive first, dual-write if needed, remove columns later. Never rewrite applied migrations on shared branches.

## Adding a feature module (API)

1. **Contracts** — Zod schemas (+ OpenAPI registration) in `packages/shared`; run `pnpm openapi:generate`.
2. **Module** under `apps/api/src/modules/<feature>/`:
   - `<feature>.routes.ts` — mount under `/v1`
   - `<feature>.controller.ts` — HTTP only
   - `<feature>.service.ts` — domain logic
   - `<feature>.repository.ts` — Prisma / I/O
3. Wire the router in `container.ts` / `app.ts`.
4. Throw domain errors from `@sprachpilot/shared` (`NotFoundError`, …); do not invent ad-hoc JSON error shapes.
5. Add tests under `apps/api/tests/` or next to the module.

Web UI: add routes under `apps/web/app/[locale]/…`, strings in `messages/*.json`, then `pnpm --filter @sprachpilot/web i18n:check`.

## Architecture docs

- Decisions: [`docs/adr/`](./docs/adr/README.md)
- API errors: [`docs/api/errors.md`](./docs/api/errors.md)
- Web i18n: [`apps/web/docs/i18n.md`](./apps/web/docs/i18n.md)

## Conduct

Everyone follows the [Code of Conduct](./CODE_OF_CONDUCT.md).

## Questions

Prefer a draft PR or ticket comment over silent assumption. When changing a foundational decision, add or supersede an ADR.
