import type { PrismaClient } from "@sprachpilot/db";
import { anonymizeTandemMessages, type TandemMessage, type ZipEntry } from "@sprachpilot/shared";

export interface ExportRecord {
  id: string;
  userId: string;
  status: "queued" | "ready" | "failed";
  objectKey: string | null;
  expiresAt: Date | null;
}

export interface PrivacyRepository {
  createExport(input: { id: string; userId: string }): Promise<void>;
  findExport(id: string): Promise<ExportRecord | null>;
  latestExport(userId: string): Promise<ExportRecord | null>;
  markExportReady(id: string, objectKey: string, expiresAt: Date, readyAt: Date): Promise<void>;
  markExportFailed(id: string): Promise<void>;
  recordings(userId: string): Promise<ZipEntry[]>;
  addRecording(userId: string, file: ZipEntry): Promise<void>;
  deleteRecordings(userId: string): Promise<void>;
  messages(): Promise<TandemMessage[]>;
  addMessage(message: TandemMessage): Promise<void>;
  anonymizeMessages(userId: string): Promise<void>;
  rememberAuditIp(userId: string, ipHash: string): Promise<void>;
  clearAuditIps(userId: string): Promise<void>;
  auditIps(userId: string): Promise<string[]>;
  deleteUserRows(userId: string): Promise<void>;
  listDueUserIds(now: Date): Promise<string[]>;
  countOverdue(now: Date): Promise<number>;
}

export interface MemoryPrivacyRepository extends PrivacyRepository {
  exportCount(userId: string): number;
}

export function createMemoryPrivacyRepository(): MemoryPrivacyRepository {
  const exports: ExportRecord[] = [];
  const recordings: { userId: string; file: ZipEntry }[] = [];
  const tandem: TandemMessage[] = [];
  const audit = new Map<string, string[]>();

  return {
    async createExport(input) {
      exports.push({
        id: input.id,
        userId: input.userId,
        status: "queued",
        objectKey: null,
        expiresAt: null,
      });
    },
    async findExport(id) {
      return exports.find((row) => row.id === id) ?? null;
    },
    async latestExport(userId) {
      const rows = exports.filter((row) => row.userId === userId);
      return rows.at(-1) ?? null;
    },
    async markExportReady(id, objectKey, expiresAt) {
      const row = exports.find((item) => item.id === id);
      if (!row || row.status === "ready") return;
      row.status = "ready";
      row.objectKey = objectKey;
      row.expiresAt = expiresAt;
    },
    async markExportFailed(id) {
      const row = exports.find((item) => item.id === id);
      if (!row || row.status === "ready") return;
      row.status = "failed";
    },
    async recordings(userId) {
      return recordings
        .filter((row) => row.userId === userId)
        .map((row) => ({ path: row.file.path, body: Buffer.from(row.file.body) }));
    },
    async addRecording(userId, file) {
      recordings.push({ userId, file: { path: file.path, body: Buffer.from(file.body) } });
    },
    async deleteRecordings(userId) {
      const kept = recordings.filter((row) => row.userId !== userId);
      recordings.splice(0, recordings.length, ...kept);
    },
    async messages() {
      return tandem.map((message) => ({ ...message }));
    },
    async addMessage(message) {
      tandem.push({ ...message });
    },
    async anonymizeMessages(userId) {
      const next = anonymizeTandemMessages(tandem, userId);
      tandem.splice(0, tandem.length, ...next);
    },
    async rememberAuditIp(userId, ipHash) {
      const current = audit.get(userId) ?? [];
      current.push(ipHash);
      audit.set(userId, current);
    },
    async clearAuditIps(userId) {
      audit.set(userId, []);
    },
    async auditIps(userId) {
      return [...(audit.get(userId) ?? [])];
    },
    async deleteUserRows(userId) {
      const kept = exports.filter((row) => row.userId !== userId);
      exports.splice(0, exports.length, ...kept);
    },
    async listDueUserIds() {
      return [];
    },
    async countOverdue() {
      return 0;
    },
    exportCount(userId) {
      return exports.filter((row) => row.userId === userId).length;
    },
  };
}

export function createPrismaPrivacyRepository(client: PrismaClient): PrivacyRepository {
  return {
    async createExport(input) {
      await client.dataExport.create({
        data: { id: input.id, userId: input.userId, status: "queued" },
      });
    },
    async findExport(id) {
      const row = await client.dataExport.findUnique({ where: { id } });
      return row ? toExport(row) : null;
    },
    async latestExport(userId) {
      const row = await client.dataExport.findFirst({
        where: { userId },
        orderBy: { createdAt: "desc" },
      });
      return row ? toExport(row) : null;
    },
    async markExportReady(id, objectKey, expiresAt, readyAt) {
      await client.dataExport.updateMany({
        where: { id, status: "queued" },
        data: { status: "ready", objectKey, expiresAt, readyAt },
      });
    },
    async markExportFailed(id) {
      await client.dataExport.updateMany({
        where: { id, status: "queued" },
        data: { status: "failed" },
      });
    },
    async recordings() {
      return [];
    },
    async addRecording() {},
    async deleteRecordings() {},
    async messages() {
      return [];
    },
    async addMessage() {},
    async anonymizeMessages() {},
    async rememberAuditIp() {},
    async clearAuditIps(userId) {
      await client.auditLog.updateMany({ where: { actorId: userId }, data: { ipHash: null } });
    },
    async auditIps(userId) {
      const rows = await client.auditLog.findMany({
        where: { actorId: userId, ipHash: { not: null } },
        select: { ipHash: true },
      });
      return rows.flatMap((row) => (row.ipHash ? [row.ipHash] : []));
    },
    async deleteUserRows(userId) {
      await client.$transaction([
        client.profile.deleteMany({ where: { userId } }),
        client.account.deleteMany({ where: { userId } }),
        client.session.deleteMany({ where: { userId } }),
        client.consentRecord.deleteMany({ where: { userId } }),
        client.emailToken.deleteMany({ where: { userId } }),
        client.pendingEmail.deleteMany({ where: { userId } }),
        client.notificationPreference.deleteMany({ where: { userId } }),
        client.quietHours.deleteMany({ where: { userId } }),
        client.dataExport.deleteMany({ where: { userId } }),
      ]);
    },
    async listDueUserIds(now) {
      const rows = await client.user.findMany({
        where: { purgeAfter: { lte: now }, deletedAt: null },
        select: { id: true },
      });
      return rows.map((row) => row.id);
    },
    async countOverdue(now) {
      const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      return client.user.count({
        where: { purgeAfter: { lte: cutoff }, deletedAt: null },
      });
    },
  };
}

function toExport(row: {
  id: string;
  userId: string;
  status: string;
  objectKey: string | null;
  expiresAt: Date | null;
}): ExportRecord {
  const status = row.status === "ready" || row.status === "failed" ? row.status : "queued";
  return {
    id: row.id,
    userId: row.userId,
    status,
    objectKey: row.objectKey,
    expiresAt: row.expiresAt,
  };
}
