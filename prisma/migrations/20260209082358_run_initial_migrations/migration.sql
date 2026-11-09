-- CreateTable
CREATE TABLE "admins" (
    "id" UUID NOT NULL,
    "fullname" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255),
    "phoneNumber" VARCHAR(255) NOT NULL,
    "username" VARCHAR(255) NOT NULL,
    "password" VARCHAR(255) NOT NULL,
    "avatar" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(6),
    "updatedAt" TIMESTAMP(6),
    "deletedAt" TIMESTAMP(6),

    CONSTRAINT "admins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modules" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(6),
    "updatedAt" TIMESTAMP(6),
    "deletedAt" TIMESTAMP(6),

    CONSTRAINT "modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "module_rules" (
    "id" UUID NOT NULL,
    "moduleId" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(6),
    "updatedAt" TIMESTAMP(6),
    "deletedAt" TIMESTAMP(6),

    CONSTRAINT "module_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_groups" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(6),
    "updatedAt" TIMESTAMP(6),
    "deletedAt" TIMESTAMP(6),

    CONSTRAINT "admin_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_group_members" (
    "id" UUID NOT NULL,
    "adminGroupId" UUID NOT NULL,
    "adminId" UUID NOT NULL,
    "createdAt" TIMESTAMP(6),
    "updatedAt" TIMESTAMP(6),

    CONSTRAINT "admin_group_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_group_access" (
    "id" UUID NOT NULL,
    "adminGroupId" UUID NOT NULL,
    "moduleRuleId" UUID NOT NULL,
    "createdAt" TIMESTAMP(6),
    "updatedAt" TIMESTAMP(6),

    CONSTRAINT "admin_group_access_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "fullname" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255),
    "phoneNumber" VARCHAR(255) NOT NULL,
    "username" VARCHAR(255) NOT NULL,
    "password" VARCHAR(255) NOT NULL,
    "avatar" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(6),
    "updatedAt" TIMESTAMP(6),
    "deletedAt" TIMESTAMP(6),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admins_username_key" ON "admins"("username");

-- CreateIndex
CREATE UNIQUE INDEX "modules_name_key" ON "modules"("name");

-- CreateIndex
CREATE INDEX "module_rules_moduleId_idx" ON "module_rules"("moduleId");

-- CreateIndex
CREATE UNIQUE INDEX "module_rules_moduleId_name_key" ON "module_rules"("moduleId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "admin_groups_name_key" ON "admin_groups"("name");

-- CreateIndex
CREATE UNIQUE INDEX "admin_group_members_adminId_adminGroupId_key" ON "admin_group_members"("adminId", "adminGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "admin_group_access_adminGroupId_moduleRuleId_key" ON "admin_group_access"("adminGroupId", "moduleRuleId");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- AddForeignKey
ALTER TABLE "module_rules" ADD CONSTRAINT "module_rules_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "modules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_group_members" ADD CONSTRAINT "admin_group_members_adminGroupId_fkey" FOREIGN KEY ("adminGroupId") REFERENCES "admin_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_group_members" ADD CONSTRAINT "admin_group_members_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "admins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_group_access" ADD CONSTRAINT "admin_group_access_adminGroupId_fkey" FOREIGN KEY ("adminGroupId") REFERENCES "admin_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_group_access" ADD CONSTRAINT "admin_group_access_moduleRuleId_fkey" FOREIGN KEY ("moduleRuleId") REFERENCES "module_rules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
