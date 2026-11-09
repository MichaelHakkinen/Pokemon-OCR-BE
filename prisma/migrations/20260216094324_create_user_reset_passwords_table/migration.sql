-- CreateTable
CREATE TABLE "user_reset_passwords" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "otp" VARCHAR(4) NOT NULL,
    "otpExpiresAt" TIMESTAMP(6) NOT NULL,
    "lastOtpSentAt" TIMESTAMP(6) NOT NULL,
    "otpVerifiedAt" TIMESTAMP(6),
    "resetToken" TEXT,
    "resetTokenExpiresAt" TIMESTAMP(6),
    "createdAt" TIMESTAMP(6),
    "updatedAt" TIMESTAMP(6),
    "deletedAt" TIMESTAMP(6),

    CONSTRAINT "user_reset_passwords_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "user_reset_passwords" ADD CONSTRAINT "user_reset_passwords_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
