-- CreateTable
CREATE TABLE "global_configs" (
    "id" UUID NOT NULL,
    "key" VARCHAR(255) NOT NULL,
    "value" TEXT,
    "createdAt" TIMESTAMP(6),
    "updatedAt" TIMESTAMP(6),

    CONSTRAINT "global_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "global_configs_key_key" ON "global_configs"("key");

-- CreateIndex
CREATE INDEX "global_configs_key_idx" ON "global_configs"("key");
