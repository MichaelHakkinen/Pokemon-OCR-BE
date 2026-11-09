import { PrismaClient } from '../../src/generated/prisma';

export const moduleSeed = async (prisma: PrismaClient) => {
  // Create modules
  const modules = [
    {
      name: 'Admin Management',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      name: 'User Management',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      name: 'Admin Group Management',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      name: 'Module Management',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      name: 'Module Rule Management',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      name: 'Banner Management',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      name: 'FAQ Management',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      name: 'Global Config Management',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  for (const module of modules) {
    await prisma.module.upsert({
      where: { name: module.name },
      update: {},
      create: module,
    });
  }

  console.log('Modules seeded.');
};
