-- Extensions used below (uuid_generate_v4, gin_trgm_ops). Created here, not only
-- in docker/postgres/init.sql, so existing volumes and Prisma's shadow database get them too.
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- CreateTable sets
CREATE TABLE IF NOT EXISTS "sets" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "series" VARCHAR(100),
    "totalCards" INTEGER,
    "releaseYear" INTEGER,
    "region" VARCHAR(50),
    "language" VARCHAR(20) NOT NULL DEFAULT 'en',
    "createdAt" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6),

    CONSTRAINT "sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable cards
CREATE TABLE IF NOT EXISTS "cards" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "setId" UUID NOT NULL,
    "collectorNumber" VARCHAR(50) NOT NULL,
    "normalizedNumber" VARCHAR(50) NOT NULL,
    "rarity" VARCHAR(50),
    "cardType" VARCHAR(50),
    "supertype" VARCHAR(50),
    "hp" VARCHAR(10),
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6),

    CONSTRAINT "cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable card_translations
CREATE TABLE IF NOT EXISTS "card_translations" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "cardId" UUID NOT NULL,
    "language" VARCHAR(20) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "flavorText" TEXT,
    "createdAt" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6),

    CONSTRAINT "card_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable user_card_collections
CREATE TABLE IF NOT EXISTS "user_card_collections" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "userId" UUID NOT NULL,
    "cardId" UUID NOT NULL,
    "condition" VARCHAR(50) NOT NULL DEFAULT 'NM',
    "grade" VARCHAR(50),
    "language" VARCHAR(20) NOT NULL DEFAULT 'en',
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "customFields" JSONB,
    "acquiredDate" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6),

    CONSTRAINT "user_card_collections_pkey" PRIMARY KEY ("id")
);

-- CreateTable export_configs
CREATE TABLE IF NOT EXISTS "export_configs" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "userId" UUID,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "fields" JSONB NOT NULL,
    "createdAt" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6),

    CONSTRAINT "export_configs_pkey" PRIMARY KEY ("id")
);

-- Unique & Indexes
CREATE UNIQUE INDEX IF NOT EXISTS "sets_code_key" ON "sets"("code");
CREATE INDEX IF NOT EXISTS "sets_code_idx" ON "sets"("code");
CREATE INDEX IF NOT EXISTS "sets_language_idx" ON "sets"("language");

CREATE UNIQUE INDEX IF NOT EXISTS "cards_setId_collectorNumber_key" ON "cards"("setId", "collectorNumber");
CREATE INDEX IF NOT EXISTS "cards_setId_idx" ON "cards"("setId");
CREATE INDEX IF NOT EXISTS "cards_collectorNumber_idx" ON "cards"("collectorNumber");
CREATE INDEX IF NOT EXISTS "cards_normalizedNumber_idx" ON "cards"("normalizedNumber");

CREATE UNIQUE INDEX IF NOT EXISTS "card_translations_cardId_language_key" ON "card_translations"("cardId", "language");
CREATE INDEX IF NOT EXISTS "card_translations_cardId_idx" ON "card_translations"("cardId");
CREATE INDEX IF NOT EXISTS "card_translations_language_idx" ON "card_translations"("language");
CREATE INDEX IF NOT EXISTS "card_translations_name_idx" ON "card_translations"("name");

-- Trigram GIN index for high-speed similarity search on card names
CREATE INDEX IF NOT EXISTS "idx_card_translations_name_trgm" ON "card_translations" USING gin ("name" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "user_card_collections_userId_idx" ON "user_card_collections"("userId");
CREATE INDEX IF NOT EXISTS "user_card_collections_cardId_idx" ON "user_card_collections"("cardId");

CREATE UNIQUE INDEX IF NOT EXISTS "export_configs_userId_key" ON "export_configs"("userId");

-- Foreign Keys
ALTER TABLE "cards" DROP CONSTRAINT IF EXISTS "cards_setId_fkey";
ALTER TABLE "cards" ADD CONSTRAINT "cards_setId_fkey" FOREIGN KEY ("setId") REFERENCES "sets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "card_translations" DROP CONSTRAINT IF EXISTS "card_translations_cardId_fkey";
ALTER TABLE "card_translations" ADD CONSTRAINT "card_translations_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_card_collections" DROP CONSTRAINT IF EXISTS "user_card_collections_userId_fkey";
ALTER TABLE "user_card_collections" ADD CONSTRAINT "user_card_collections_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_card_collections" DROP CONSTRAINT IF EXISTS "user_card_collections_cardId_fkey";
ALTER TABLE "user_card_collections" ADD CONSTRAINT "user_card_collections_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "export_configs" DROP CONSTRAINT IF EXISTS "export_configs_userId_fkey";
ALTER TABLE "export_configs" ADD CONSTRAINT "export_configs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

