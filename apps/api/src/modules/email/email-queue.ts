import {
  EMAIL_JOB_ATTEMPTS,
  EMAIL_JOB_BACKOFF_MS,
  EMAIL_JOB_NAME,
  EMAIL_QUEUE_NAME,
  type EmailJob,
} from "@sprachpilot/shared";
import { Queue } from "bullmq";
import type { Redis } from "ioredis";

/** Producer defaults. The worker retries a failed send up to EMAIL_JOB_ATTEMPTS. */
export const EMAIL_QUEUE_JOB_OPTIONS = {
  attempts: EMAIL_JOB_ATTEMPTS,
  backoff: { type: "exponential" as const, delay: EMAIL_JOB_BACKOFF_MS },
  removeOnComplete: true,
  removeOnFail: 100,
};

export interface EmailQueue {
  enqueue(job: EmailJob): Promise<void>;
  close(): Promise<void>;
}

export interface MemoryEmailQueue extends EmailQueue {
  jobs(): readonly EmailJob[];
}

export function createMemoryEmailQueue(): MemoryEmailQueue {
  const queued: EmailJob[] = [];

  return {
    async enqueue(job) {
      queued.push(job);
    },
    async close() {},
    jobs() {
      return queued;
    },
  };
}

/**
 * BullMQ producer. The connection must use `maxRetriesPerRequest: null`.
 * Callers that only construct the API for tests should inject a memory queue
 * so this process does not open Redis.
 */
export function createBullEmailQueue(connection: Redis): EmailQueue {
  const queue = new Queue<EmailJob>(EMAIL_QUEUE_NAME, {
    connection,
    defaultJobOptions: EMAIL_QUEUE_JOB_OPTIONS,
  });

  return {
    async enqueue(job) {
      await queue.add(EMAIL_JOB_NAME, job);
    },
    async close() {
      await queue.close();
    },
  };
}
