import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

export type BannerResponse = {
  id: string;
  title?: string;
  subtitle?: string;
  mediaUrl: string;
  urlTarget?: string;
  isActive: boolean;
  ordinal?: number;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date | null;
};

export type QueryType = {
  search?: string;
  deletedItems?: boolean;
};

export type BannerDatatableType = {
  search?: string;
  status?: boolean;
  deletedItems?: boolean;
};

@Injectable()
export class BannerModel {
  constructor(private readonly prisma: PrismaService) {}

  findAll = async (queryOptions?: QueryType): Promise<BannerResponse[]> => {
    const whereConditions: any = {
      ...(queryOptions?.deletedItems ? {} : { deletedAt: null }),
      ...(queryOptions?.search
        ? {
            OR: [
              {
                title: {
                  contains: queryOptions.search,
                  mode: 'insensitive',
                },
              },
              {
                subtitle: {
                  contains: queryOptions.search,
                  mode: 'insensitive',
                },
              },
            ],
          }
        : {}),
    };

    return await this.prisma.banner.findMany({
      where: whereConditions,
      orderBy: {
        ordinal: 'asc',
      },
    });
  };

  findOneIgnoreStatus = async (id: string): Promise<BannerResponse | null> => {
    return await this.prisma.banner.findFirst({
      where: { id: id },
    });
  };

  getLatestOrdinal = async (): Promise<number> => {
    const latestBanner = await this.prisma.banner.findFirst({
      orderBy: {
        ordinal: 'desc',
      },
      select: {
        ordinal: true,
      },
    });
    return latestBanner ? latestBanner.ordinal : 0;
  };
}
