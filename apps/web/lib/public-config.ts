import { z } from "zod";

const publicEnvSchema = z.object({
  NEXT_PUBLIC_APP_NAME: z.string().min(1).default("SprachPilot"),
});

export type PublicConfig = Readonly<{
  name: string;
}>;

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
  }
  return value;
}

function formatZodError(error: z.ZodError): string {
  const lines = error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
    return `  - ${path}: ${issue.message}`;
  });
  return `Invalid public configuration:\n${lines.join("\n")}`;
}

export function loadPublicConfig(env: NodeJS.ProcessEnv = process.env): PublicConfig {
  const result = publicEnvSchema.safeParse({
    NEXT_PUBLIC_APP_NAME: env["NEXT_PUBLIC_APP_NAME"],
  });
  if (!result.success) {
    throw new Error(formatZodError(result.error));
  }

  return deepFreeze({
    name: result.data.NEXT_PUBLIC_APP_NAME,
  });
}

/** Client-safe config. Only `NEXT_PUBLIC_*` values. */
export const publicConfig: PublicConfig = loadPublicConfig();
