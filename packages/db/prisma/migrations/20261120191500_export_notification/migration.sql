-- The archive can be ready before its email is queued. Retries send the notification again.

ALTER TABLE "data_exports" ADD COLUMN "notified_at" TIMESTAMPTZ(3);
