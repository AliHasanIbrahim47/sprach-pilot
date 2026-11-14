import { createServer } from "node:http";

import {
  createAccountRepository,
  createPrismaPrivacyRepository,
  createPrivacyMetrics,
  createPrivacyService,
  createSessionRepository,
  createSettingsRepository,
  createUserRepository,
  type ObjectStorage,
} from "@sprachpilot/api/privacy";
import { prisma } from "@sprachpilot/db";
import { createS3Bucket } from "@sprachpilot/s3";
import {
  AVATAR_QUEUE_NAME,
  createHealthStatus,
  EMAIL_JOB_ATTEMPTS,
  EMAIL_JOB_BACKOFF_MS,
  EMAIL_JOB_NAME,
  EMAIL_QUEUE_NAME,
  type EmailJob,
  GDPR_EXPORT_JOB_NAME,
  GDPR_PURGE_JOB_NAME,
  GDPR_QUEUE_NAME,
  gdprExportJobSchema,
  gdprPurgeJobSchema,
  type HealthStatus,
} from "@sprachpilot/shared";
import { Queue, UnrecoverableError, Worker } from "bullmq";
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

async function startWorker(): Promise<void> {
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
  const gdprConnection = new Redis(config.redisUrl, { maxRetriesPerRequest: null });
  const gdprProducerConnection = new Redis(config.redisUrl, { maxRetriesPerRequest: null });
  const emailProducerConnection = new Redis(config.redisUrl, { maxRetriesPerRequest: null });
  const emailProducer = new Queue<EmailJob>(EMAIL_QUEUE_NAME, {
    connection: emailProducerConnection,
  });
  const bucket = createS3Bucket(config.s3);
  const storage: ObjectStorage = {
    put: (input) => bucket.put(input),
    get: (key) => bucket.get(key),
    delete: (key) => bucket.delete(key),
    list: (prefix) => bucket.list(prefix),
  };
  const privacyMetrics = createPrivacyMetrics();
  const privacy = createPrivacyService({
    users: createUserRepository(),
    accounts: createAccountRepository(),
    sessions: createSessionRepository(),
    settings: createSettingsRepository(),
    store: createPrismaPrivacyRepository(prisma),
    storage,
    emailQueue: {
      async enqueue(job) {
        await emailProducer.add(EMAIL_JOB_NAME, job, {
          attempts: EMAIL_JOB_ATTEMPTS,
          backoff: { type: "exponential", delay: EMAIL_JOB_BACKOFF_MS },
          removeOnComplete: true,
          removeOnFail: 100,
        });
      },
      async close() {
        await emailProducer.close();
      },
    },
    gdprQueue: {
      async enqueueExport() {},
      async enqueuePurge() {},
      pullExports: () => [],
      pullDuePurges: () => [],
      async close() {},
    },
    metrics: privacyMetrics,
    clock: () => new Date(),
    ipHashSecret: config.ipHashSecret,
    webPublicUrl: config.webPublicUrl,
  });
  const gdprProducer = new Queue(GDPR_QUEUE_NAME, { connection: gdprProducerConnection });
  await gdprProducer.upsertJobScheduler(
    "gdpr-due-purge",
    { every: 60 * 60 * 1000 },
    { name: "sweep", data: {} },
  );
  const gdprWorker = new Worker(
    GDPR_QUEUE_NAME,
    async (job) => {
      if (job.name === GDPR_EXPORT_JOB_NAME) {
        const parsed = gdprExportJobSchema.safeParse(job.data);
        if (!parsed.success) throw new UnrecoverableError("invalid gdpr export");
        await privacy.processExportJob(parsed.data);
        return;
      }
      if (job.name === GDPR_PURGE_JOB_NAME) {
        const parsed = gdprPurgeJobSchema.safeParse(job.data);
        if (!parsed.success) throw new UnrecoverableError("invalid gdpr purge");
        await privacy.processPurgeJob(parsed.data.userId);
        return;
      }
      if (job.name === "sweep") {
        await privacy.processDuePurges();
      }
    },
    { connection: gdprConnection, concurrency: 2 },
  );
  const metricsServer = createServer((req, res) => {
    if (req.url?.split("?")[0] !== "/metrics") {
      res.writeHead(404);
      res.end();
      return;
    }
    res.writeHead(200, { "content-type": "text/plain; version=0.0.4" });
    res.end(privacyMetrics.renderPrometheus());
  });
  await new Promise<void>((resolve, reject) => {
    metricsServer.once("error", reject);
    metricsServer.listen(config.metricsPort, resolve);
  });
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
    `[worker] ${health.service} status=${health.status} queues=${EMAIL_QUEUE_NAME},${AVATAR_QUEUE_NAME},${GDPR_QUEUE_NAME} ai.mode=${config.ai.mode}`,
  );

  let shuttingDown = false;
  const shutdown = async (): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    await worker.close();
    await avatarWorker.close();
    await gdprWorker.close();
    await gdprProducer.close();
    await new Promise<void>((resolve) => {
      metricsServer.close(() => resolve());
    });
    await emailProducer.close();
    connection.disconnect();
    avatarConnection.disconnect();
    gdprConnection.disconnect();
    gdprProducerConnection.disconnect();
    emailProducerConnection.disconnect();
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

void startWorker().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
