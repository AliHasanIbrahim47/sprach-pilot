# ADR-0007: OpenAPI generated from shared Zod contracts

- Status: Accepted
- Date: 2026-09-28
- Deciders: Backend / Frontend
- Ticket: SP-006

## Context

API request/response shapes must stay in sync with the Next.js web app. Hand-written OpenAPI drifts. We need one source of truth that validates at the edge and documents itself.

## Decision

Use **Zod** schemas in `packages/shared` as the source of truth.

- Infer TypeScript types with `z.infer`.
- Generate **OpenAPI 3.1** with `@asteasolutions/zod-to-openapi`.
- Serve docs with **Scalar** (`@scalar/express-api-reference`) at `/docs` in non-production.
- Commit `packages/shared/openapi/openapi.json` (and regenerate in CI when schemas change).

## Alternatives considered

| Option | Why not |
| --- | --- |
| Hand-written OpenAPI + separate DTOs | Duplicates types; docs drift |
| `zod-openapi` (Sam Chung) | Viable; team preferred the more established `zod-to-openapi` registry API |
| tRPC / GraphQL | Out of scope; REST + OpenAPI is the product choice |
| NestJS Swagger decorators | We use Express, not Nest |

## Consequences

- Schemas must stay free of Node-only imports so the web bundle can use them.
- Feature tickets add Zod schemas in `packages/shared` before routes/forms.
- SP-009 maps validation failures into the shared Problem Details shape already used by the validation middleware.
