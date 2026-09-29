import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildOpenApiDocument } from "../src/openapi/document.js";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.join(packageRoot, "openapi");
const outputPath = path.join(outputDir, "openapi.json");

const document = buildOpenApiDocument();

mkdirSync(outputDir, { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(document, null, 2)}\n`, "utf8");

console.info(`[openapi] wrote ${path.relative(packageRoot, outputPath)}`);
