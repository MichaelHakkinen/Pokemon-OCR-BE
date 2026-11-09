-- CreateTable
CREATE TABLE "banners" (
    "id" UUID NOT NULL,
    "title" VARCHAR(255),
    "subtitle" VARCHAR(255),
    "mediaUrl" TEXT NOT NULL,
    "urlTarget" TEXT,
    "ordinal" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(6),
    "updatedAt" TIMESTAMP(6),
    "deletedAt" TIMESTAMP(6),

    CONSTRAINT "banners_pkey" PRIMARY KEY ("id")
);
