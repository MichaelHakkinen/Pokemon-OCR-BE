-- CreateTable
CREATE TABLE "mail_relay_logs" (
    "id" UUID NOT NULL,
    "method" VARCHAR(10),
    "url" TEXT,
    "recipient" TEXT,
    "subject" TEXT,
    "templateName" VARCHAR(100),
    "requestHeaders" TEXT,
    "requestBody" TEXT,
    "responseStatus" INTEGER,
    "responseHeaders" TEXT,
    "responseBody" TEXT,
    "isSuccess" BOOLEAN NOT NULL DEFAULT false,
    "errorMessage" TEXT,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "mail_relay_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mail_relay_logs_recipient_idx" ON "mail_relay_logs"("recipient");

-- CreateIndex
CREATE INDEX "mail_relay_logs_responseStatus_idx" ON "mail_relay_logs"("responseStatus");

-- CreateIndex
CREATE INDEX "mail_relay_logs_createdAt_idx" ON "mail_relay_logs"("createdAt");

