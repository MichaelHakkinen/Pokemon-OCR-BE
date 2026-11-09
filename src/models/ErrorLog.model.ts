import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

export type ErrorLogData = {
  endpoint?: string;
  errorMessage?: string;
  adminId?: string;
  moduleId?: string;
  targetId?: string;
  remarks?: string;
  ipAddress?: string;
  userAgent?: string;
};

@Injectable()
export class ErrorLogModel {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new error log entry
   */
  createLog = async (data: ErrorLogData) => {
    return await this.prisma.errorLog.create({
      data: {
        endpoint: data.endpoint,
        errorMessage: data.errorMessage,
        adminId: data.adminId,
        moduleId: data.moduleId,
        targetId: data.targetId,
        remarks: data.remarks,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
  };

  /**
   * Get all error logs with pagination
   */
  findAll = async (skip: number = 0, take: number = 10) => {
    return await this.prisma.errorLog.findMany({
      skip,
      take,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        admin: {
          select: {
            id: true,
            fullname: true,
            email: true,
            username: true,
          },
        },
        module: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  };

  /**
   * Get error logs by admin ID
   */
  findByAdminId = async (
    adminId: string,
    skip: number = 0,
    take: number = 10,
  ) => {
    return await this.prisma.errorLog.findMany({
      where: {
        adminId,
      },
      skip,
      take,
      orderBy: {
        createdAt: 'desc',
      },
    });
  };

  /**
   * Get error logs by module ID
   */
  findByModuleId = async (
    moduleId: string,
    skip: number = 0,
    take: number = 10,
  ) => {
    return await this.prisma.errorLog.findMany({
      where: {
        moduleId,
      },
      skip,
      take,
      orderBy: {
        createdAt: 'desc',
      },
    });
  };

  /**
   * Count all error logs
   */
  countAll = async (): Promise<number> => {
    return await this.prisma.errorLog.count();
  };

  /**
   * Count error logs by admin ID
   */
  countByAdminId = async (adminId: string): Promise<number> => {
    return await this.prisma.errorLog.count({
      where: {
        adminId,
      },
    });
  };

  /**
   * Delete error logs older than specified days
   */
  deleteOlderThan = async (days: number) => {
    const date = new Date();
    date.setDate(date.getDate() - days);

    return await this.prisma.errorLog.deleteMany({
      where: {
        createdAt: {
          lt: date,
        },
      },
    });
  };
}
