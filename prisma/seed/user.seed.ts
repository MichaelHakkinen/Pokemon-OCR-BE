import { PrismaClient } from '../../src/generated/prisma';
import * as bcrypt from 'bcrypt';

export const userSeed = async (prisma: PrismaClient) => {
  const hashedPassword = await bcrypt.hash('User123!', 10);

  // Create user accounts
  const users = [
    {
      username: 'user1',
      fullname: 'John Doe',
      email: 'john.doe@example.com',
      phoneNumber: '+6281234567890',
      password: hashedPassword,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      username: 'user2',
      fullname: 'Jane Smith',
      email: 'jane.smith@example.com',
      phoneNumber: '+6281234567891',
      password: hashedPassword,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: { username: user.username },
      update: {},
      create: user,
    });
  }

  // Fixed-id demo user the Flutter app uses via x-user-id while
  // DEV_USER_HEADER_AUTH=true (no mobile login yet). Must match ApiService.mockUserId.
  await prisma.user.upsert({
    where: { username: 'demo' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'demo',
      fullname: 'Demo Collector',
      email: 'demo@example.com',
      phoneNumber: '+6281234567899',
      password: hashedPassword,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });

  console.log('User accounts seeded.');
};
