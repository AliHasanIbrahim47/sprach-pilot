/**
 * Turbo execs the packageManager pnpm binary directly. pnpm 12 ships a
 * shebang-less placeholder that only works via shell/execvp until install.js
 * replaces it with the native ELF. Corepack / ignored scripts leave the
 * placeholder, which Turbo fails with "Exec format error" / exit 137.
 *
 * Run from the repo root prepare hook so local + CI stay healthy.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const rootPackageJsonPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "package.json",
);

function readPinnedPnpmVersion() {
  const raw = fs.readFileSync(rootPackageJsonPath, "utf8");
  const packageJson = JSON.parse(raw);
  const packageManager = packageJson.packageManager;

  if (typeof packageManager !== "string" || !packageManager.startsWith("pnpm@")) {
    return null;
  }

  return packageManager.slice("pnpm@".length);
}

function isNativeElf(filePath) {
  const fd = fs.openSync(filePath, "r");

  try {
    const header = Buffer.alloc(4);
    const bytesRead = fs.readSync(fd, header, 0, 4, 0);
    return bytesRead === 4 && header[0] === 0x7f && header.toString("ascii", 1, 4) === "ELF";
  } finally {
    fs.closeSync(fd);
  }
}

function main() {
  const version = readPinnedPnpmVersion();
  if (!version) return;

  const wrapperDir = path.join(
    os.homedir(),
    ".local",
    "share",
    "pnpm",
    ".tools",
    "pnpm",
    version,
    "node_modules",
    "pnpm",
  );
  const binPath = path.join(wrapperDir, "pnpm");
  const installScript = path.join(wrapperDir, "install.js");

  if (!fs.existsSync(binPath) || !fs.existsSync(installScript)) return;
  if (isNativeElf(binPath)) return;

  console.info(`[ensure-pnpm-native] materializing pnpm@${version} native binary…`);
  const result = spawnSync(process.execPath, [installScript], {
    cwd: wrapperDir,
    stdio: "inherit",
  });

  if (result.status !== 0) {
    console.warn(
      "[ensure-pnpm-native] failed to install the native binary; turbo may fail with Exec format error.",
    );
    console.warn(`  Manual fix: node ${installScript}`);
  }
}

main();
