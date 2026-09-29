# @sprachpilot/shared

Cross-cutting TypeScript helpers and **Zod contracts** shared by API and web (SP-006).

## Contracts

| Module                   | Purpose                                                       |
| ------------------------ | ------------------------------------------------------------- |
| `health`                 | `/healthz` and `/readyz` response schemas                     |
| `auth/register`          | `POST /v1/auth/register` body (auth implementation is SP-012) |
| `errors/problem-details` | RFC 9457 problem + field errors (full middleware in SP-009)   |

Import from the package root so the browser never pulls OpenAPI generator code:

```ts
import { registerBodySchema, type RegisterBody } from "@sprachpilot/shared";
```

## OpenAPI

Schemas are registered with `@asteasolutions/zod-to-openapi` (OpenAPI 3.1). Regenerate the committed document after schema changes:

```bash
pnpm openapi:generate
# or
pnpm --filter @sprachpilot/shared openapi:generate
```

Output: `packages/shared/openapi/openapi.json` (also exported as `@sprachpilot/shared/openapi.json`).

The API serves this document at `/openapi.json` and Scalar UI at `/docs` when not in production (or when `ENABLE_API_DOCS=true`).
