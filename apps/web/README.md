# Web (`@sprachpilot/web`)

Next.js App Router frontend for SprachPilot.

## Quick start

```bash
pnpm --filter @sprachpilot/web dev
```

App: `http://localhost:3000` (redirects to a locale prefix, e.g. `/en`)  
Health probe: `GET /api/health`

## Locales (SP-010)

| Locale | UI language | Direction |
| ------ | ----------- | --------- |
| `en`   | English     | LTR       |
| `de`   | German      | LTR       |
| `ar`   | Arabic      | RTL       |
| `uk`   | Ukrainian   | LTR       |
| `tr`   | Turkish     | LTR       |

- Messages: `messages/*.json`
- Routing/middleware: `i18n/` + `middleware.ts`
- Workflow: [`docs/i18n.md`](./docs/i18n.md)
- Key parity: `pnpm --filter @sprachpilot/web i18n:check`

Learning content stays German and should be marked `lang="de"` when embedded in other UI languages.

## Route groups

| Group         | Path examples         | Purpose               |
| ------------- | --------------------- | --------------------- |
| `(marketing)` | `/{locale}`           | Public landing        |
| `(auth)`      | `/{locale}/sign-in`   | Auth screens (SP-012) |
| `(app)`       | `/{locale}/dashboard` | Authenticated shell   |

Shared chrome (header, footer, skip link, theme, language switcher) lives in layouts under those groups; `app/[locale]/layout.tsx` owns fonts, `lang`/`dir`, and the intl provider.

## Design system

- Tailwind CSS v4 with CSS variables (Baltic teal brand tokens)
- Prefer logical utilities (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`) for RTL
- shadcn/ui-style primitives in `components/ui`
- Dark/light theme via `next-themes` (persisted)

## API client

`lib/api-client.ts` — server-side `apiFetch` that reads `API_BASE_URL` and forwards cookies to the Express API.  
`lib/api-error-messages.ts` — maps Problem Details `type` URIs to `Errors.*` message keys.

## Scripts

| Command                                     | Description                               |
| ------------------------------------------- | ----------------------------------------- |
| `pnpm --filter @sprachpilot/web dev`        | Next.js dev server on port 3000           |
| `pnpm --filter @sprachpilot/web build`      | Production build (`output: "standalone"`) |
| `pnpm --filter @sprachpilot/web test`       | i18n key check + Vitest                   |
| `pnpm --filter @sprachpilot/web i18n:check` | Fail if locales miss `en` keys            |
| `pnpm --filter @sprachpilot/web lint`       | ESLint                                    |
