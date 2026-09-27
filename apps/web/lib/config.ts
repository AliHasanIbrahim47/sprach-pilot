export const appConfig = {
  name: process.env["NEXT_PUBLIC_APP_NAME"] ?? "SprachPilot",
  apiBaseUrl: process.env["API_BASE_URL"] ?? "http://localhost:3001",
} as const;
