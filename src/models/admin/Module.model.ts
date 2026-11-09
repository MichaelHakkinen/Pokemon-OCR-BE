import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { DatatableType } from 'src/types/datatable';

export type ModuleResponse = {
  id: string;
  name: string;
  isActive: boolean;
};

@Injectable()
export class ModuleModel {
  constructor(private readonly prisma: PrismaService) {}

  countAll = async (DatatableType?: DatatableType): Promise<number> => {
    return await this.prisma.module.count({
      where: {
        deletedAt: null,
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
    return await this.prisma.module.findMany({
      where: {
        deletedAt: null,
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
    return await this.prisma.module.findFirst({
      where: {
        id,
      },
    });
  };

  findByNameIgnoreStatus = async (
    name: string,
  ): Promise<ModuleResponse | null> => {
    return await this.prisma.module.findFirst({
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
