import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { apiReference } from "@scalar/express-api-reference";
import { type Request, type Response, Router } from "express";

import { bindRoute, declareMount, tagRouter } from "../access/route-access.js";

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
  const router = tagRouter(Router(), "");
  const document = loadOpenApiDocument();

  bindRoute(router, "get", "/openapi.json", { kind: "public" }, [
    (_req: Request, res: Response) => {
      res.status(200).json(document);
    },
  ]);

  router.use(
    "/docs",
    apiReference({
      url: "/openapi.json",
      pageTitle: "SprachPilot API",
    }),
  );
  declareMount(router, "/docs", { kind: "public" });

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
