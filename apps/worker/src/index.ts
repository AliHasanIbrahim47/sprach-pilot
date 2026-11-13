import { prisma } from "@sprachpilot/db";
import {
  AVATAR_QUEUE_NAME,
  createHealthStatus,
  EMAIL_QUEUE_NAME,
  type HealthStatus,
} from "@sprachpilot/shared";
import { Worker } from "bullmq";
import { Redis } from "ioredis";

import { createAvatarProcessor } from "./avatar/process-avatar-job.js";
import { createS3AvatarStorage } from "./avatar/s3-storage.js";
import { formatConfigForLog, loadConfig } from "./config.js";
import { emailNotificationAllowed } from "./email/hold-notification.js";
import { createSmtpMailer } from "./email/mailer.js";
import { createEmailProcessor } from "./email/process-email-job.js";

/**
 * Background worker. Email jobs (SP-014) are the first queue; later epics reuse it.
 */
export function getWorkerHealth(): HealthStatus {
  return createHealthStatus("worker");
}

export async function disconnectWorkerDb(): Promise<void> {
  await prisma.$disconnect();
}

function startWorker(): void {
  let config;
  try {
    config = loadConfig();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }

  console.info("[worker] config", formatConfigForLog(config));

  const connection = new Redis(config.redisUrl, { maxRetriesPerRequest: null });
  const avatarConnection = new Redis(config.redisUrl, { maxRetriesPerRequest: null });
  const worker = new Worker(
    EMAIL_QUEUE_NAME,
    createEmailProcessor(createSmtpMailer(config.smtp), {
      allowsNotification: (notice) => emailNotificationAllowed(notice),
    }),
    {
      connection,
      concurrency: 4,
    },
  );
  const avatarWorker = new Worker(
    AVATAR_QUEUE_NAME,
    createAvatarProcessor({
      storage: createS3AvatarStorage(config.s3),
      async saveAvatarUrl(userId, avatarUrl) {
        await prisma.profile.update({ where: { userId }, data: { avatarUrl } });
      },
    }),
    { connection: avatarConnection, concurrency: 2 },
  );

  worker.on("failed", (job, error) => {
    console.error("[worker] email job failed", {
      id: job?.id,
      attempts: job?.attemptsMade,
      reason: error.name,
    });
  });
  worker.on("error", (error) => {
    console.error("[worker] email queue error", { reason: error.name });
  });
  avatarWorker.on("failed", (job, error) => {
    console.error("[worker] avatar job failed", {
      id: job?.id,
      attempts: job?.attemptsMade,
      reason: error.name,
    });
  });
  avatarWorker.on("error", (error) => {
    console.error("[worker] avatar queue error", { reason: error.name });
  });

  const health = getWorkerHealth();
  console.log(
    `[worker] ${health.service} status=${health.status} queues=${EMAIL_QUEUE_NAME},${AVATAR_QUEUE_NAME} ai.mode=${config.ai.mode}`,
  );

  let shuttingDown = false;
  const shutdown = async (): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    await worker.close();
    await avatarWorker.close();
    connection.disconnect();
    avatarConnection.disconnect();
    try {
      await disconnectWorkerDb();
    } catch {
      // The process is exiting; a closed database is acceptable.
    }
  };

  process.once("SIGTERM", () => {
    void shutdown().then(() => process.exit(0));
  });
  process.once("SIGINT", () => {
    void shutdown().then(() => process.exit(0));
  });
}

startWorker();
