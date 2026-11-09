-- OTPs are now stored as SHA-256 digests and support configurable length,
-- so the column widens to TEXT. Outstanding plaintext OTPs can't be verified
-- against a hash, so pending reset requests are closed.
ALTER TABLE "admin_reset_passwords" ALTER COLUMN "otp" SET DATA TYPE TEXT;
ALTER TABLE "admin_reset_passwords" ADD COLUMN "failedAttempts" INTEGER NOT NULL DEFAULT 0;
UPDATE "admin_reset_passwords" SET "deletedAt" = NOW() WHERE "deletedAt" IS NULL;

ALTER TABLE "user_reset_passwords" ALTER COLUMN "otp" SET DATA TYPE TEXT;
ALTER TABLE "user_reset_passwords" ADD COLUMN "failedAttempts" INTEGER NOT NULL DEFAULT 0;
UPDATE "user_reset_passwords" SET "deletedAt" = NOW() WHERE "deletedAt" IS NULL;

-- Refresh tokens are now stored hashed and grouped into sessions. Existing
-- plaintext tokens can never match a hashed lookup, so they are revoked:
-- every client signs in once more after this migration. The DB default only
-- backfills existing rows; new ids come from Prisma (@default(uuid())).
ALTER TABLE "admin_refresh_tokens" ADD COLUMN "sessionId" UUID NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE "admin_refresh_tokens" ALTER COLUMN "sessionId" DROP DEFAULT;
UPDATE "admin_refresh_tokens" SET "isRevoked" = true;
CREATE INDEX "admin_refresh_tokens_sessionId_idx" ON "admin_refresh_tokens"("sessionId");

ALTER TABLE "user_refresh_tokens" ADD COLUMN "sessionId" UUID NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE "user_refresh_tokens" ALTER COLUMN "sessionId" DROP DEFAULT;
UPDATE "user_refresh_tokens" SET "isRevoked" = true;
CREATE INDEX "user_refresh_tokens_sessionId_idx" ON "user_refresh_tokens"("sessionId");
