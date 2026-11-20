-- GDPR export, deletion grace, and consent changes (SP-019).

ALTER TABLE "users" ADD COLUMN "deletion_requested_at" TIMESTAMPTZ(3),
ADD COLUMN "purge_after" TIMESTAMPTZ(3),
ADD COLUMN "recording_storage_transient" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "users_purge_after_idx" ON "users"("purge_after");

ALTER TABLE "consent_records" ADD COLUMN "decision" TEXT NOT NULL DEFAULT 'granted';

ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_decision_check" CHECK ("decision" IN ('granted', 'withdrawn'));

CREATE TABLE "data_exports" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" TEXT NOT NULL,
    "object_key" TEXT,
    "expires_at" TIMESTAMPTZ(3),
    "ready_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "data_exports_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "data_exports_status_check" CHECK ("status" IN ('queued', 'ready', 'failed'))
);

CREATE INDEX "data_exports_user_id_idx" ON "data_exports"("user_id");

ALTER TABLE "data_exports" ADD CONSTRAINT "data_exports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
