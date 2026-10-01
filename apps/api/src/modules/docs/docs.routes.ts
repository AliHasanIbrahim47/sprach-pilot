import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { apiReference } from "@scalar/express-api-reference";
import { type Request, type Response,Router } from "express";

const require = createRequire(import.meta.url);

function loadOpenApiDocument(): unknown {
  try {
    return require("@sprachpilot/shared/openapi.json") as unknown;
  } catch {
    const candidate = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../../../../../packages/shared/openapi/openapi.json",
    );
    return JSON.parse(readFileSync(candidate, "utf8")) as unknown;
  }
}

export function createDocsRouter(): Router {
  const router = Router();
  const document = loadOpenApiDocument();

  router.get("/openapi.json", (_req: Request, res: Response) => {
    res.status(200).json(document);
  });

  router.use(
    "/docs",
    apiReference({
      url: "/openapi.json",
      pageTitle: "SprachPilot API",
    }),
  );

  return router;
}

export function shouldEnableApiDocs(input: {
  nodeEnv: string;
  enableApiDocs: boolean | undefined;
}): boolean {
  if (input.enableApiDocs === true) return true;
  if (input.enableApiDocs === false) return false;
  return input.nodeEnv !== "production";
}
