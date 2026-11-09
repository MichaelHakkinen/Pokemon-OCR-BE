import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { DatatableType } from '../../types/datatable';

@Injectable()
export class GlobalConfigModel {
  constructor(private readonly prisma: PrismaService) {}

  countAll = async (datatable?: DatatableType): Promise<number> => {
    return await this.prisma.globalConfig.count({
      where: {
        ...(datatable?.search
          ? {
              OR: [
                { key: { contains: datatable.search, mode: 'insensitive' } },
                { value: { contains: datatable.search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
    });
  };

  findAll = async (datatable: DatatableType): Promise<any[]> => {
    return await this.prisma.globalConfig.findMany({
      where: {
        ...(datatable?.search
          ? {
              OR: [
                { key: { contains: datatable.search, mode: 'insensitive' } },
                { value: { contains: datatable.search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { [datatable.sort]: datatable.sortDirection },
      take: datatable.limit,
      skip: datatable.offset,
    });
  };

  findOne = async (id: string): Promise<any | null> => {
    return await this.prisma.globalConfig.findFirst({ where: { id } });
  };

  findByKey = async (key: string): Promise<string | null> => {
    const config = await this.prisma.globalConfig.findFirst({ where: { key } });
    return config?.value ?? null;
  };
}
