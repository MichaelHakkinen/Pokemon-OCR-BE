-- CreateTable
CREATE TABLE "logs" (
    "id" UUID NOT NULL,
    "logDetailId" UUID NOT NULL,
    "adminId" UUID NOT NULL,
    "moduleId" UUID,
    "targetId" VARCHAR(100),
    "notes" TEXT,
    "valueBefore" TEXT,
    "valueAfter" TEXT,
    "url" TEXT,
    "ipAddress" VARCHAR(50),
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(6),
    "updatedAt" TIMESTAMP(6),

    CONSTRAINT "logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "log_details" (
    "id" UUID NOT NULL,
    "action" VARCHAR(100) NOT NULL,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "log_details_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "log_details_action_key" ON "log_details"("action");

-- AddForeignKey
ALTER TABLE "logs" ADD CONSTRAINT "logs_logDetailId_fkey" FOREIGN KEY ("logDetailId") REFERENCES "log_details"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logs" ADD CONSTRAINT "logs_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "admins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logs" ADD CONSTRAINT "logs_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "modules"("id") ON DELETE SET NULL ON UPDATE CASCADE;
