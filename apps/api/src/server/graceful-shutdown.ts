import type { Server } from "node:http";

export interface GracefulShutdownOptions {
  timeoutMs: number;
  logger?: Pick<Console, "info" | "error">;
  onShutdown?: () => Promise<void> | void;
}

export function setupGracefulShutdown(
  server: Server,
  options: GracefulShutdownOptions,
): () => void {
  const logger = options.logger ?? console;
  let isShuttingDown = false;

  async function shutdown(signal: string): Promise<void> {
    if (isShuttingDown) return;
    isShuttingDown = true;
    logger.info(`[api] received ${signal}, starting graceful shutdown`);

    const forceTimer = setTimeout(() => {
      logger.error(`[api] shutdown timed out after ${options.timeoutMs}ms, forcing exit`);
      process.exit(1);
    }, options.timeoutMs);
    forceTimer.unref();

    server.close(async (error) => {
      clearTimeout(forceTimer);

      if (error) {
        logger.error(`[api] error while closing server: ${error.message}`);
        process.exit(1);
        return;
      }

      try {
        await options.onShutdown?.();
        logger.info("[api] shutdown complete");
        process.exit(0);
      } catch (shutdownError) {
        const message =
          shutdownError instanceof Error ? shutdownError.message : String(shutdownError);
        logger.error(`[api] shutdown hook failed: ${message}`);
        process.exit(1);
      }
    });

    // Node 18+: drop keep-alive sockets that would otherwise block close.
    if (typeof server.closeIdleConnections === "function") {
      server.closeIdleConnections();
    }
  }

  const onSigterm = () => {
    void shutdown("SIGTERM");
  };
  const onSigint = () => {
    void shutdown("SIGINT");
  };

  process.on("SIGTERM", onSigterm);
  process.on("SIGINT", onSigint);

  return () => {
    process.off("SIGTERM", onSigterm);
    process.off("SIGINT", onSigint);
  };
}
