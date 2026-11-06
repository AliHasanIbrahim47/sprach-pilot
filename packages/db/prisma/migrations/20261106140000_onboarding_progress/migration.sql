-- Onboarding resume pointer and approximate city centroid (SP-017).
-- Postal codes are not stored.

CREATE TYPE "onboarding_step" AS ENUM ('languages', 'level', 'quiz', 'goals', 'city');

ALTER TABLE "profiles"
  ADD COLUMN "onboarding_step" "onboarding_step" NOT NULL DEFAULT 'languages',
  ADD COLUMN "onboarding_skipped_at" TIMESTAMPTZ(3),
  ADD COLUMN "city_latitude" DECIMAL(9, 6),
  ADD COLUMN "city_longitude" DECIMAL(9, 6);
