# API error catalogue (SP-009)

All error responses use [RFC 9457 Problem Details](https://www.rfc-editor.org/rfc/rfc9457) with
`Content-Type: application/problem+json`.

## Shape

| Field | Required | Description |
| --- | --- | --- |
| `type` | yes | URI under `https://sprachpilot.app/errors/<code>` |
| `title` | yes | Short, stable summary |
| `status` | yes | HTTP status code |
| `detail` | no | Human-readable explanation (omitted for sensitive 5xx/upstream errors) |
| `instance` | no | Request path (`req.originalUrl`) |
| `requestId` | no | Correlation id (also in `X-Request-Id`) |
| `errors` | no | Field-level issues (validation) |

The web app maps `type` codes to translated UI messages (SP-010).

## Catalogue

| Code | HTTP | `type` suffix | When |
| --- | --- | --- | --- |
| Validation | 400 | `/validation` | Zod / input validation failed |
| Unauthorized | 401 | `/unauthorized` | Missing or invalid credentials |
| Forbidden | 403 | `/forbidden` | Authenticated but not allowed |
| Not Found | 404 | `/not-found` | Missing resource or unmatched route |
| Conflict | 409 | `/conflict` | Unique constraint / state conflict (also Prisma `P2002`) |
| Rate Limited | 429 | `/rate-limited` | Client exceeded rate limits |
| External Service | 502 | `/external-service` | Upstream AI / mail / storage failure |
| Internal | 500 | `/internal` | Unexpected error |

### Prisma mapping

| Prisma code | HTTP | Domain error |
| --- | --- | --- |
| `P2002` | 409 | Conflict |
| `P2025` | 404 | Not Found |

## Production behaviour

- Unknown exceptions → **500** with a generic `detail` (`An unexpected error occurred`).
- Stack traces and SQL are **never** returned to clients; they are logged with `requestId`.
- In non-production, `detail` may include the exception message for faster debugging.
- 4xx are logged at **info**; 5xx at **error** (with stack).

## Versioning

Feature routes live under `/v1`. Responses from that tree include `API-Version: 1`.
Health probes (`/healthz`, `/readyz`) and docs (`/docs`, `/openapi.json`) stay unversioned.

## Pagination

List endpoints use cursor pagination:

```http
GET /v1/<resource>?cursor=<opaque>&limit=<n>
```

- Default `limit`: 20
- Max `limit`: **100** (higher values are clamped)
- Response includes `items`, `nextCursor` (`null` when no further page), and `limit`

```ts
import { createCursorPage, cursorPaginationQuerySchema } from "@sprachpilot/shared";
```
