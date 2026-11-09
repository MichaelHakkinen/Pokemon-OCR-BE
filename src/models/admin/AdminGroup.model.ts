import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { DatatableType } from 'src/types/datatable';

export type AdminGroupResponse = {
  id: string;
  name: string;
  isActive: boolean;
};

@Injectable()
export class AdminGroupModel {
  constructor(private readonly prisma: PrismaService) {}

  countAll = async (DatatableType?: DatatableType): Promise<number> => {
    return await this.prisma.adminGroup.count({
      where: {
        deletedAt: null,
        name: { not: '*root' },
        ...(DatatableType?.search
          ? {
              OR: [
                {
                  name: {
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
    return await this.prisma.adminGroup.findMany({
      where: {
        deletedAt: null,
        name: { not: '*root' },
        ...(DatatableType.search
          ? {
              OR: [
                {
                  name: {
                    contains: DatatableType.search,
                    mode: 'insensitive',
                  },
                },
              ],
            }
          : {}),
      },
      orderBy: {
        [DatatableType.sort]: DatatableType.sortDirection,
      },
      take: DatatableType.limit,
      skip: DatatableType.offset,
    });
  };

  findOneIgnoreStatus = async (id: string): Promise<any> => {
    return await this.prisma.adminGroup.findFirst({
      where: {
        id,
        name: { not: '*root' },
      },
      include: {
        admins: {
          include: {
            admin: {
              select: {
                id: true,
                fullname: true,
                username: true,
              },
            },
          },
        },
        modules: {
          include: {
            moduleRule: {
              include: {
                module: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    });
  };

  findByNameIgnoreStatus = async (
    name: string,
  ): Promise<AdminGroupResponse | null> => {
    return await this.prisma.adminGroup.findFirst({
      where: {
        name,
      },
      select: {
        id: true,
        name: true,
        isActive: true,
      },
    });
  };
}
