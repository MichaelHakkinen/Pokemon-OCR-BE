-- CreateTable
CREATE TABLE "faqs" (
    "id" UUID NOT NULL,
    "parentId" UUID,
    "text1" TEXT NOT NULL,
    "text2" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(6),
    "updatedAt" TIMESTAMP(6),
    "deletedAt" TIMESTAMP(6),

    CONSTRAINT "faqs_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "faqs" ADD CONSTRAINT "faqs_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "faqs"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
