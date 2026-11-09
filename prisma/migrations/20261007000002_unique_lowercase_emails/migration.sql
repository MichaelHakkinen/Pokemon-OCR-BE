-- Emails are now stored trimmed + lowercase (the API normalises them) and must
-- be unique per table, soft-deleted rows included — the same rule as
-- usernames. Normalise existing data first; empty strings become NULL (NULLs
-- don't collide). If two rows already share an email (ignoring case), the
-- index creation fails: resolve those duplicates and re-run the migration.
UPDATE "admins" SET "email" = NULLIF(LOWER(TRIM("email")), '') WHERE "email" IS NOT NULL;
UPDATE "users" SET "email" = NULLIF(LOWER(TRIM("email")), '') WHERE "email" IS NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "admins_email_key" ON "admins"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
