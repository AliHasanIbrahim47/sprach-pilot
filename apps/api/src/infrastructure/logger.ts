export type AppLogger = {
  info: (message: string, meta?: Record<string, unknown>) => void;
  error: (message: string, meta?: Record<string, unknown>) => void;
};

export function createConsoleLogger(service = "api"): AppLogger {
  return {
    info(message, meta) {
      console.info(`[${service}] ${message}`, meta ?? "");
    },
    error(message, meta) {
      console.error(`[${service}] ${message}`, meta ?? "");
    },
  };
}
