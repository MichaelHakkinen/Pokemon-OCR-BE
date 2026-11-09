-- CreateTable
CREATE TABLE "error_logs" (
    "id" UUID NOT NULL,
    "endpoint" TEXT,
    "errorMessage" TEXT,
    "adminId" UUID,
    "moduleId" UUID,
    "targetId" UUID,
    "remarks" TEXT,
    "ipAddress" VARCHAR(45),
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(6),
    "updatedAt" TIMESTAMP(6),

    CONSTRAINT "error_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "error_logs_adminId_idx" ON "error_logs"("adminId");

-- CreateIndex
CREATE INDEX "error_logs_moduleId_idx" ON "error_logs"("moduleId");

-- AddForeignKey
ALTER TABLE "error_logs" ADD CONSTRAINT "error_logs_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "error_logs" ADD CONSTRAINT "error_logs_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "modules"("id") ON DELETE SET NULL ON UPDATE CASCADE;
