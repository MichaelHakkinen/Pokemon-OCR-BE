import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { DatatableType } from 'src/types/datatable';

export type UserCredential = {
  id: string;
  fullname: string;
  email: string;
  password: string;
  avatar: string | null;
};

export type UserResponse = {
  id: string;
  fullname: string;
  email: string;
  avatar: string | null;
  deletedAt?: Date | null;
};

@Injectable()
export class UserModel {
  constructor(private readonly prisma: PrismaService) {}

  countAll = async (DatatableType?: DatatableType): Promise<number> => {
    return await this.prisma.user.count({
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
    return await this.prisma.user.findMany({
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
      orderBy: {
        [DatatableType.sort]: DatatableType.sortDirection,
      },
      take: DatatableType.limit,
      skip: DatatableType.offset,
    });
  };

  findOne = async (id: string): Promise<UserResponse | null> => {
    return await this.prisma.user.findFirst({
      where: { id: id, isActive: true, deletedAt: null },
      omit: { password: true },
    });
  };

  findOneIgnoreStatus = async (id: string): Promise<UserResponse | null> => {
    return await this.prisma.user.findFirst({
      where: { id: id },
      // never let the hash reach responses or audit logs (valueBefore)
      omit: { password: true },
    });
  };

  findByUsernameIgnoreStatus = async (
    username: string,
  ): Promise<UserCredential | null> => {
    return await this.prisma.user.findFirst({
      where: { username: username },
      select: {
        id: true,
        fullname: true,
        email: true,
        username: true,
        password: true,
        avatar: true,
      },
    });
  };
}
