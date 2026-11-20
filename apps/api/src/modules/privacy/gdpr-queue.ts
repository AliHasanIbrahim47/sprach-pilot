import {
  GDPR_EXPORT_JOB_NAME,
  GDPR_JOB_ATTEMPTS,
  GDPR_JOB_BACKOFF_MS,
  GDPR_PURGE_JOB_NAME,
  GDPR_QUEUE_NAME,
  type GdprExportJob,
  type GdprPurgeJob,
} from "@sprachpilot/shared";
import { Queue } from "bullmq";
import type { Redis } from "ioredis";

export interface GdprQueue {
  enqueueExport(job: GdprExportJob): Promise<void>;
  enqueuePurge(job: GdprPurgeJob, runAt: Date): Promise<void>;
  pullExports(): GdprExportJob[];
  pullDuePurges(now: Date): string[];
  close(): Promise<void>;
}

interface QueuedPurge {
  userId: string;
  runAt: Date;
}

export function createMemoryGdprQueue(): GdprQueue {
  const exports: GdprExportJob[] = [];
  const purges: QueuedPurge[] = [];
  return {
    async enqueueExport(job) {
      exports.push(job);
    },
    async enqueuePurge(job, runAt) {
      purges.push({ userId: job.userId, runAt });
    },
    pullExports() {
      return exports.splice(0, exports.length);
    },
    pullDuePurges(now) {
      const due = purges.filter((job) => job.runAt.getTime() <= now.getTime());
      for (const job of due) {
        const index = purges.indexOf(job);
        if (index >= 0) purges.splice(index, 1);
      }
      return due.map((job) => job.userId);
    },
    async close() {},
  };
}

export function createBullGdprQueue(connection: Redis): GdprQueue {
  const queue = new Queue(GDPR_QUEUE_NAME, {
    connection,
    defaultJobOptions: {
      attempts: GDPR_JOB_ATTEMPTS,
      backoff: { type: "exponential", delay: GDPR_JOB_BACKOFF_MS },
      removeOnComplete: true,
      removeOnFail: 100,
    },
  });
  return {
    async enqueueExport(job) {
      await queue.add(GDPR_EXPORT_JOB_NAME, job);
    },
    async enqueuePurge(job, runAt) {
      const delay = Math.max(0, runAt.getTime() - Date.now());
      await queue.add(GDPR_PURGE_JOB_NAME, job, { delay });
    },
    pullExports() {
      return [];
    },
    pullDuePurges() {
      return [];
    },
    async close() {
      await queue.close();
    },
  };
}
