import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class OptionModel {
  constructor(private readonly prisma: PrismaService) {}

  getAdminGroups = async (): Promise<any[]> => {
    return await this.prisma.adminGroup.findMany({
      where: {
        isActive: true,
        deletedAt: null,
        name: { not: '*root' },
      },
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        name: 'asc',
      },
    });
  };

  getModuleRules = async (): Promise<any[]> => {
    return await this.prisma.moduleRule.findMany({
      where: {
        deletedAt: null,
        module: {
          isActive: true,
          deletedAt: null,
        },
      },
      select: {
        id: true,
        name: true,
        description: true,
        module: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [
        {
          module: {
            name: 'asc',
          },
        },
        {
          name: 'asc',
        },
      ],
    });
  };
}
