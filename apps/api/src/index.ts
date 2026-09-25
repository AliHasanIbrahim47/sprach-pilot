import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createContainer } from "./container.js";
import { setupGracefulShutdown } from "./server/graceful-shutdown.js";

export function startServer(): void {
  const config = loadConfig();
  const container = createContainer(config);
  const app = createApp(container);

  const server = app.listen(config.port, () => {
    console.info(`[api] listening on http://localhost:${config.port}`);
  });

  setupGracefulShutdown(server, {
    timeoutMs: config.shutdownTimeoutMs,
  });
}

startServer();
