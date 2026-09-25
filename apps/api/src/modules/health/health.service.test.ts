import { describe, expect, it } from "vitest";

import type { HealthRepository } from "./health.repository.js";
import { createHealthService } from "./health.service.js";

function createRepository(
  results: Array<{ name: "database" | "redis"; ok: boolean }>,
): HealthRepository {
  return {
    checkDependencies: async () => results,
  };
}

describe("HealthService", () => {
  it("returns liveness without touching dependencies", () => {
    const service = createHealthService(createRepository([]));
    expect(service.getLiveness()).toEqual({ status: "ok" });
  });

  it("reports ready when all dependencies are healthy", async () => {
    const service = createHealthService(
      createRepository([
        { name: "database", ok: true },
        { name: "redis", ok: true },
      ]),
    );

    await expect(service.getReadiness()).resolves.toEqual({
      status: "ok",
      checks: { database: "ok", redis: "ok" },
      failing: [],
    });
  });

  it("names failing dependencies when not ready", async () => {
    const service = createHealthService(
      createRepository([
        { name: "database", ok: false },
        { name: "redis", ok: true },
      ]),
    );

    await expect(service.getReadiness()).resolves.toEqual({
      status: "not_ready",
      checks: { database: "fail", redis: "ok" },
      failing: ["database"],
    });
  });
});
