# Architecture Decision Records

Short records of significant technical choices for SprachPilot. Format: [MADR](https://adr.github.io/madr/) (trimmed).

## Status values

| Status | Meaning |
| --- | --- |
| **Proposed** | Under discussion; not binding yet |
| **Accepted** | Current decision; follow it |
| **Superseded** | Replaced by a newer ADR (link required) |

When a decision changes: write a new ADR, set the old one's status to **Superseded** with a link to the new ADR, and update this index.

## Index

| ADR | Title | Status |
| --- | --- | --- |
| [0001](./0001-monorepo-pnpm-turborepo.md) | Monorepo with pnpm and Turborepo | Accepted |
| [0002](./0002-express-nextjs-split.md) | Express + Next.js split | Accepted |
| [0003](./0003-postgresql-prisma.md) | PostgreSQL + Prisma | Accepted |
| [0004](./0004-github-actions-ci-jenkins-cd.md) | GitHub Actions for CI, Jenkins for CD | Accepted |
| [0005](./0005-ai-provider-abstraction.md) | AI provider abstraction (OCR, TTS, STT, LLM) | Accepted |
| [0006](./0006-kubernetes-helm-observability.md) | Kubernetes + Helm, Prometheus + Grafana | Accepted |
| [0007](./0007-openapi-from-zod.md) | OpenAPI generated from shared Zod contracts | Accepted |

## Adding an ADR

1. Copy [`TEMPLATE.md`](./TEMPLATE.md) to `NNNN-short-title.md` (next free number).
2. Fill Context, Decision, Alternatives, Consequences.
3. Set status to **Proposed** until review; then **Accepted**.
4. Add a row to the index above.
5. Keep it to about one page; link spikes or tickets for deep data.
