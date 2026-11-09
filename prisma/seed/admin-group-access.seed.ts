import { PrismaClient } from '../../src/generated/prisma';

export const adminGroupAccessSeed = async (prisma: PrismaClient) => {
  // get Admin group
  const group = await prisma.adminGroup.findFirst({
    where: {
      name: {
        not: '*root',
      },
    },
  });

  if (!group) {
    console.error("Admin group not found. Make sure it's seeded.");
    return;
  }

  // get all module rules
  const moduleRules = await prisma.moduleRule.findMany();

  for (const moduleRule of moduleRules) {
    await prisma.adminGroupAccess.upsert({
      where: {
        adminGroupId_moduleRuleId: {
          adminGroupId: group.id,
          moduleRuleId: moduleRule.id,
        },
      },
      update: {},
      create: {
        adminGroupId: group.id,
        moduleRuleId: moduleRule.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }

  console.log('Admin group access seeded.');
};
