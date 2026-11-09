import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { DatatableType } from 'src/types/datatable';

export type AdminCredential = {
  id: string;
  fullname: string;
  email: string;
  password: string;
  avatar: string | null;
  phoneNumber: string | null;
};

export type AdminResponse = {
  id: string;
  fullname: string;
  email: string;
  avatar: string | null;
};

@Injectable()
export class AdminModel {
  constructor(private readonly prisma: PrismaService) {}

  countAll = async (DatatableType?: DatatableType): Promise<number> => {
    return await this.prisma.admin.count({
      where: {
        deletedAt: null,
        ...(DatatableType?.search
          ? {
              OR: [
                {
                  fullname: {
                    contains: DatatableType.search,
                    mode: 'insensitive',
                  },
                },
                {
                  email: {
                    contains: DatatableType.search,
                    mode: 'insensitive',
                  },
                },
                {
                  username: {
                    contains: DatatableType.search,
                    mode: 'insensitive',
                  },
                },
                {
                  phoneNumber: {
                    contains: DatatableType.search,
                    mode: 'insensitive',
                  },
                },
              ],
            }
          : {}),
      },
    });
  };

  findAll = async (DatatableType: DatatableType): Promise<any[]> => {
    return await this.prisma.admin.findMany({
      where: {
        deletedAt: null,
        ...(DatatableType.search
          ? {
              OR: [
                {
                  fullname: {
                    contains: DatatableType.search,
                    mode: 'insensitive',
                  },
                },
                {
                  email: {
                    contains: DatatableType.search,
                    mode: 'insensitive',
                  },
                },
                {
                  username: {
                    contains: DatatableType.search,
                    mode: 'insensitive',
                  },
                },
                {
                  phoneNumber: {
                    contains: DatatableType.search,
                    mode: 'insensitive',
                  },
                },
              ],
            }
          : {}),
      },
      include: {
        adminGroupMembers: {
          where: {
            adminGroup: {
              name: { not: '*root' },
              deletedAt: null,
              isActive: true,
            },
          },
          include: {
            adminGroup: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        [DatatableType.sort]: DatatableType.sortDirection,
      },
      take: DatatableType.limit,
      skip: DatatableType.offset,
    });
  };

  findOne = async (id: string): Promise<AdminResponse | null> => {
    return await this.prisma.admin.findFirst({
      where: { id: id, isActive: true, deletedAt: null },
      omit: { password: true },
    });
  };

  findOneIgnoreStatus = async (id: string): Promise<any> => {
    return await this.prisma.admin.findFirst({
      where: { id: id },
      // never let the hash reach responses or audit logs (valueBefore)
      omit: { password: true },
      include: {
        adminGroupMembers: {
          where: {
            adminGroup: {
              name: { not: '*root' },
              deletedAt: null,
              isActive: true,
            },
          },
          include: {
            adminGroup: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });
  };

  // please don't change the select, this for authentication purpose
  findByEmail = async (email: string): Promise<AdminCredential | null> => {
    return await this.prisma.admin.findFirst({
      where: { email: email, isActive: true, deletedAt: null },
      select: {
        id: true,
        fullname: true,
        email: true,
        password: true,
        avatar: true,
        phoneNumber: true,
      },
    });
  };

  // please don't change the select, this for authentication purpose
  findByUsername = async (
    username: string,
  ): Promise<AdminCredential | null> => {
    return await this.prisma.admin.findFirst({
      where: { username: username, isActive: true, deletedAt: null },
      select: {
        id: true,
        fullname: true,
        email: true,
        password: true,
        avatar: true,
        phoneNumber: true,
      },
    });
  };

  findByUsernameIgnoreStatus = async (
    username: string,
  ): Promise<AdminCredential | null> => {
    return await this.prisma.admin.findFirst({
      where: { username: username },
      select: {
        id: true,
        fullname: true,
        email: true,
        username: true,
        password: true,
        avatar: true,
        phoneNumber: true,
      },
    });
  };

  getAdminGroups = async (adminId: string) => {
    return this.prisma.adminGroupMember.findMany({
      where: {
        adminId,
        adminGroup: {
          deletedAt: null,
          isActive: true,
        },
      },
      include: {
        adminGroup: true,
      },
    });
  };

  getAdminGroupAccess = async (adminGroupIds: string[]) => {
    const accessList = await this.prisma.adminGroupAccess.findMany({
      where: {
        adminGroupId: { in: adminGroupIds },
        adminGroup: {
          deletedAt: null,
          isActive: true,
        },
        moduleRule: {
          deletedAt: null,
          module: {
            isActive: true,
            deletedAt: null,
          },
        },
      },
      include: {
        moduleRule: {
          include: { module: true },
        },
      },
    });

    // Group by module
    const moduleMap = new Map();

    accessList.forEach((access) => {
      const moduleId = access.moduleRule.module.id;

      if (!moduleMap.has(moduleId)) {
        moduleMap.set(moduleId, {
          id: access.id,
          adminGroupId: access.adminGroupId,
          module: {
            id: access.moduleRule.module.id,
            name: access.moduleRule.module.name,
            rules: [],
          },
        });
      }

      moduleMap.get(moduleId).module.rules.push({
        id: access.moduleRule.id,
        name: access.moduleRule.name,
      });
    });

    return Array.from(moduleMap.values());
  };
}
