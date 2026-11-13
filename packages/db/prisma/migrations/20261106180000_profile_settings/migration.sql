-- Profile settings: pending email, notification switches, and quiet hours (SP-018).

CREATE TABLE "pending_emails" (
    "user_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pending_emails_pkey" PRIMARY KEY ("user_id")
);

CREATE UNIQUE INDEX "pending_emails_email_key" ON "pending_emails"("email");

ALTER TABLE "pending_emails" ADD CONSTRAINT "pending_emails_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "notification_preferences" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "channel" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "notification_preferences_channel_check" CHECK ("channel" IN ('email', 'push')),
    CONSTRAINT "notification_preferences_category_check" CHECK ("category" IN ('review_reminders', 'event_reminders', 'match_requests', 'product_news'))
);

CREATE UNIQUE INDEX "notification_preferences_user_channel_category_key" ON "notification_preferences"("user_id", "channel", "category");

CREATE INDEX "notification_preferences_user_id_idx" ON "notification_preferences"("user_id");

ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "quiet_hours" (
    "user_id" UUID NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "start_minute" INTEGER NOT NULL,
    "end_minute" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "quiet_hours_pkey" PRIMARY KEY ("user_id"),
    CONSTRAINT "quiet_hours_start_minute_check" CHECK ("start_minute" >= 0 AND "start_minute" <= 1439),
    CONSTRAINT "quiet_hours_end_minute_check" CHECK ("end_minute" >= 0 AND "end_minute" <= 1439),
    CONSTRAINT "quiet_hours_window_check" CHECK ("start_minute" <> "end_minute")
);

ALTER TABLE "quiet_hours" ADD CONSTRAINT "quiet_hours_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "email_tokens" DROP CONSTRAINT "email_tokens_purpose_check";

ALTER TABLE "email_tokens" ADD CONSTRAINT "email_tokens_purpose_check" CHECK ("purpose" IN ('email_verification', 'password_reset', 'email_change'));
