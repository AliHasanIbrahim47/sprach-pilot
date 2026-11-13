import { AVATAR_JOB_NAME, AVATAR_QUEUE_NAME, type AvatarJob } from "@sprachpilot/shared";
import { Queue } from "bullmq";
import type { Redis } from "ioredis";

export interface AvatarQueue {
  enqueue(job: AvatarJob): Promise<void>;
  close(): Promise<void>;
}

export interface MemoryAvatarQueue extends AvatarQueue {
  jobs(): readonly AvatarJob[];
}

export function createMemoryAvatarQueue(): MemoryAvatarQueue {
  const queued: AvatarJob[] = [];
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
 * BullMQ producer for avatar processing. Tests inject the memory queue
 * so this process does not open Redis.
 */
export function createBullAvatarQueue(connection: Redis): AvatarQueue {
  const queue = new Queue<AvatarJob>(AVATAR_QUEUE_NAME, {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 1_000 },
      removeOnComplete: true,
      removeOnFail: 100,
    },
  });

  return {
    async enqueue(job) {
      await queue.add(AVATAR_JOB_NAME, job);
    },
    async close() {
      await queue.close();
    },
  };
}
