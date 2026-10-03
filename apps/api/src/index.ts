import { createApp } from "./app.js";
import { formatConfigForLog, loadConfig } from "./config.js";
import { createContainer } from "./container.js";
import { setupGracefulShutdown } from "./server/graceful-shutdown.js";

export function startServer(): void {
  let config;
  try {
    config = loadConfig();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }

  console.info("[api] config", formatConfigForLog(config));

  const container = createContainer(config);
  const app = createApp(container);

  const server = app.listen(config.port, () => {
    console.info(`[api] listening on http://localhost:${config.port}`);
  });

  setupGracefulShutdown(server, {
    timeoutMs: config.shutdownTimeoutMs,
    onShutdown: async () => {
      await container.close();
    },
  });
}

startServer();
