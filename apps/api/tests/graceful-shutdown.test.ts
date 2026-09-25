import http from "node:http";

import { afterEach, describe, expect, it, vi } from "vitest";

import { setupGracefulShutdown } from "../src/server/graceful-shutdown.js";

describe("setupGracefulShutdown", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("closes the server on SIGTERM and exits after in-flight work finishes", async () => {
    vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);

    const server = http.createServer((_req, res) => {
      res.writeHead(200);
      res.end("ok");
    });

    await new Promise<void>((resolve) => {
      server.listen(0, resolve);
    });

    const onShutdown = vi.fn(async () => undefined);
    const dispose = setupGracefulShutdown(server, {
      timeoutMs: 25_000,
      logger: { info: vi.fn(), error: vi.fn() },
      onShutdown,
    });

    process.emit("SIGTERM");

    await vi.waitFor(() => {
      expect(onShutdown).toHaveBeenCalledOnce();
      expect(process.exit).toHaveBeenCalledWith(0);
    });

    dispose();
  });
});
