# Web (`@sprachpilot/web`)

Next.js App Router frontend for SprachPilot.

## Quick start

```bash
pnpm --filter @sprachpilot/web dev
```

App: `http://localhost:3000`  
Health probe: `GET /api/health`

## Route groups

| Group         | Path examples | Purpose               |
| ------------- | ------------- | --------------------- |
| `(marketing)` | `/`           | Public landing        |
| `(auth)`      | `/sign-in`    | Auth screens (SP-012) |
| `(app)`       | `/dashboard`  | Authenticated shell   |

Shared chrome (header, footer, skip link, theme) lives in layouts under those groups; root `app/layout.tsx` owns fonts and the theme provider.

## Design system

- Tailwind CSS v4 with CSS variables (Baltic teal brand tokens)
- shadcn/ui-style primitives in `components/ui` (`button` seeded; add more with the shadcn CLI)
- Dark/light theme via `next-themes` (persisted)

## API client

`lib/api-client.ts` — server-side `apiFetch` that reads `API_BASE_URL` and forwards cookies to the Express API.

## Scripts

| Command                                | Description                               |
| -------------------------------------- | ----------------------------------------- |
| `pnpm --filter @sprachpilot/web dev`   | Next.js dev server on port 3000           |
| `pnpm --filter @sprachpilot/web build` | Production build (`output: "standalone"`) |
| `pnpm --filter @sprachpilot/web test`  | Vitest + Testing Library                  |
| `pnpm --filter @sprachpilot/web lint`  | ESLint                                    |
