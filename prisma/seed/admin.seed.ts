import { PrismaClient } from '../../src/generated/prisma';
import * as bcrypt from 'bcrypt';

export const adminSeed = async (prisma: PrismaClient) => {
  const hashedPassword = await bcrypt.hash('Admin123!', 10);

  // Create admin users
  const adminUsers = [
    {
      username: 'superadmin',
      fullname: 'Super Administrator',
      email: 'superadmin@example.com',
      phoneNumber: '+6281212341234',
      password: hashedPassword,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      username: 'admin',
      fullname: 'Administrator',
      email: 'admin@example.com',
      phoneNumber: '+6281212341235',
      password: hashedPassword,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  for (const admin of adminUsers) {
    await prisma.admin.upsert({
      where: { username: admin.username },
      update: {},
      create: admin,
    });
  }

  console.log('Admin users seeded.');
};
