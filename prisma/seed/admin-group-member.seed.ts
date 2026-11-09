import { PrismaClient } from '../../src/generated/prisma';

export const adminGroupMemberSeed = async (prisma: PrismaClient) => {
  // Assign superadmin to *root group
  const superadmin = await prisma.admin.findUnique({
    where: { username: 'superadmin' },
  });
  const rootGroup = await prisma.adminGroup.findUnique({
    where: { name: '*root' },
  });

  if (!superadmin || !rootGroup) {
    console.error(
      'Superadmin or *root group not found. Ensure adminSeed and adminGroupSeed are run first.',
    );
    return;
  }

  await prisma.adminGroupMember.upsert({
    where: {
      adminId_adminGroupId: {
        adminId: superadmin.id,
        adminGroupId: rootGroup.id,
      },
    },
    update: {},
    create: {
      adminId: superadmin.id,
      adminGroupId: rootGroup.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });

  // Assign admin to Admin group
  const admin = await prisma.admin.findUnique({ where: { username: 'admin' } });
  const adminGroup = await prisma.adminGroup.findUnique({
    where: { name: 'Admin' },
  });

  if (!admin || !adminGroup) {
    console.error(
      'Admin or Admin group not found. Ensure adminSeed and adminGroupSeed are run first.',
    );
    return;
  }

  await prisma.adminGroupMember.upsert({
    where: {
      adminId_adminGroupId: {
        adminId: admin.id,
        adminGroupId: adminGroup.id,
      },
    },
    update: {},
    create: {
      adminId: admin.id,
      adminGroupId: adminGroup.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });

  console.log('Admin group members seeded.');
};
