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

  console.log('User accounts seeded.');
};
