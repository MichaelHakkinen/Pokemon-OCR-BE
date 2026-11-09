import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

export type FAQResponse = {
  id: string;
  parentId?: string;
  text1: string;
  text2: string;
  ordinal: number;
  level: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

export type QueryType = {
  search?: string;
  deletedItems?: boolean;
  parentId?: string | null;
};

@Injectable()
export class FaqModel {
  constructor(private readonly prisma: PrismaService) {}

  findAll = async (queryOptions: QueryType): Promise<any[]> => {
    const whereConditions: any = {
      ...(queryOptions.deletedItems ? {} : { deletedAt: null }),
      ...(queryOptions.parentId !== undefined
        ? { parentId: queryOptions.parentId || null }
        : {}),
      ...(queryOptions.search
        ? {
            OR: [
              {
                text1: {
                  contains: queryOptions.search,
                  mode: 'insensitive',
                },
              },
              {
                text2: {
                  contains: queryOptions.search,
                  mode: 'insensitive',
                },
              },
            ],
          }
        : {}),
    };

    return await this.prisma.fAQ.findMany({
      where: whereConditions,
      orderBy: [{ level: 'asc' }, { ordinal: 'asc' }],
      include: {
        parent: {
          select: {
            id: true,
            text1: true,
            text2: true,
            level: true,
          },
        },
        children: {
          select: {
            id: true,
            text1: true,
            text2: true,
            level: true,
          },
          where: {
            deletedAt: null,
          },
        },
      },
    });
  };

  findOne = async (id: string): Promise<any> => {
    return await this.prisma.fAQ.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      include: {
        parent: {
          select: {
            id: true,
            text1: true,
            text2: true,
            level: true,
          },
        },
        children: {
          select: {
            id: true,
            text1: true,
            text2: true,
            level: true,
          },
          where: {
            deletedAt: null,
          },
        },
      },
    });
  };

  findByText1IgnoreStatus = async (text1: string): Promise<any> => {
    return await this.prisma.fAQ.findFirst({
      where: {
        text1: {
          equals: text1,
          mode: 'insensitive',
        },
      },
    });
  };
}
