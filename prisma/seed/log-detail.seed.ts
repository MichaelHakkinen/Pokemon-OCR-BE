import { PrismaClient } from '../../src/generated/prisma';

export const logDetailSeed = async (prisma: PrismaClient) => {
  // Create logDetails
  const logDetails = [
    {
      action: 'LOGIN',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      action: 'EDIT PROFILE',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      action: 'ADD NEW',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      action: 'VIEW',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      action: 'UPDATE',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      action: 'DELETE',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      action: 'RESTORE',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      action: 'IMPORT',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  for (const logDetail of logDetails) {
    await prisma.logDetail.upsert({
      where: { action: logDetail.action },
      update: {},
      create: logDetail,
    });
  }

  console.log('Log details seeded.');
};
