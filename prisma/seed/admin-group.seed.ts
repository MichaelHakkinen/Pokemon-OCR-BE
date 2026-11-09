import { PrismaClient } from '../../src/generated/prisma';

export const adminGroupSeed = async (prisma: PrismaClient) => {
  // Create admin groups
  const adminGroups = [
    {
      name: '*root',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      name: 'Admin',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  for (const group of adminGroups) {
    await prisma.adminGroup.upsert({
      where: { name: group.name },
      update: {},
      create: group,
    });
  }

  console.log('Admin groups seeded.');
};
