import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { DatatableType } from 'src/types/datatable';

export type ModuleRuleResponse = {
  id: string;
  name: string;
  description?: string;
  moduleId: string;
};

@Injectable()
export class ModuleRuleModel {
  constructor(private readonly prisma: PrismaService) {}

  countAll = async (datatableType: DatatableType): Promise<number> => {
    return await this.prisma.moduleRule.count({
      where: {
        deletedAt: null,
        ...(datatableType.search
          ? {
              OR: [
                {
                  name: {
                    contains: datatableType.search,
                    mode: 'insensitive',
                  },
                },
              ],
            }
          : {}),
        ...(datatableType.filter?.moduleId
          ? {
              moduleId: String(datatableType.filter.moduleId),
            }
          : {}),
      },
    });
  };

  findAll = async (
    datatableType: DatatableType,
  ): Promise<ModuleRuleResponse[]> => {
    return await this.prisma.moduleRule.findMany({
      where: {
        deletedAt: null,
        ...(datatableType.search
          ? {
              OR: [
                {
                  name: {
                    contains: datatableType.search,
                    mode: 'insensitive',
                  },
                },
              ],
            }
          : {}),
        ...(datatableType.filter?.moduleId
          ? {
              moduleId: String(datatableType.filter.moduleId),
            }
          : {}),
      },
      include: {
        module: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        [datatableType.sort]: datatableType.sortDirection,
      },
      take: datatableType.limit,
      skip: datatableType.offset,
    });
  };

  findOne = async (id: string): Promise<ModuleRuleResponse | null> => {
    return await this.prisma.moduleRule.findFirst({
      where: {
        id: id,
        deletedAt: null,
      },
      include: {
        module: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  };

  findOneIgnoreStatus = async (id: string): Promise<any> => {
    return await this.prisma.moduleRule.findFirst({
      where: {
        id,
      },
      include: {
        module: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  };

  findByNameIgnoreStatus = async (
    name: string,
    moduleId: string,
  ): Promise<ModuleRuleResponse | null> => {
    return await this.prisma.moduleRule.findFirst({
      where: {
        name,
        moduleId,
      },
      select: {
        id: true,
        name: true,
        description: true,
        moduleId: true,
      },
    });
  };
}
