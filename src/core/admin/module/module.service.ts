import { BadRequestException, Injectable } from '@nestjs/common';
import { AdminAccessService } from 'src/common/auth/admin-access.service';
import { HelperService } from 'src/utils/helper.service';
import { DatatableType } from 'src/types/datatable';
import { CreateModuleDto, UpdateModuleDto } from './dto/module.dto';
import { ErrorMessageHelper } from 'src/common/helpers/error-message.helper';
import { LogActions } from 'src/common/constants/log-actions';
import { PrismaService } from 'src/prisma/prisma.service';
import { ModuleModel } from 'src/models';

@Injectable()
export class ModuleService {
  constructor(
    private readonly helper: HelperService,
    private readonly adminAccess: AdminAccessService,
    private readonly prisma: PrismaService,
    private readonly moduleModel: ModuleModel,
  ) {}

  async findAll(datatable: DatatableType): Promise<any> {
    // get total from all data (with same filters as findAll)
    const totalCount = await this.moduleModel.countAll(datatable);

    // query per page
    const data = await this.moduleModel.findAll(datatable);

    return {
      pagination: {
        totalCount,
        currentPage: datatable.page,
        lowestNumber: data.length > 0 ? datatable.offset + 1 : 0,
        highestNumber: datatable.offset + data.length,
      },
      data,
    };
  }

  async findOne(
    id: string,
    adminId?: string,
    request?: any,
    moduleName?: string,
  ): Promise<any> {
    if (!id) {
      throw new BadRequestException(
        ErrorMessageHelper.getMultiLanguageMessage('MODULE_NOT_FOUND'),
      );
    }

    // get data
    const data = await this.moduleModel.findOneIgnoreStatus(id);

    if (!data) {
      throw new BadRequestException(
        ErrorMessageHelper.getMultiLanguageMessage('MODULE_NOT_FOUND'),
      );
    }

    // Log View action
    await this.helper.logAction(LogActions.VIEW, {
      adminId,
      request,
      moduleName,
      targetId: id,
      notes: 'View Module Detail',
    });

    return data;
  }

  async checkNameExist(name: string): Promise<boolean> {
    const data = await this.moduleModel.findByNameIgnoreStatus(name);
    return !!data;
  }

  async create(
    createModuleDto: CreateModuleDto,
    adminId?: string,
    request?: any,
    moduleName?: string,
  ): Promise<any> {
    const transaction = await this.prisma.$transaction(async (tx) => {
      // create data
      const data = await tx.module.create({
        data: {
          name: createModuleDto.name,
          isActive: createModuleDto.isActive ?? true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      // normalize data
      const normalizedData = {
        ...data,
      };

      return normalizedData;
    });

    // Log creation action
    await this.helper.logAction(LogActions.ADD_NEW, {
      adminId,
      request,
      moduleName,
      targetId: transaction.id,
      notes: 'Add New Module',
      valueAfter: transaction,
    });

    // RBAC data changed — drop cached admin permissions
    await this.adminAccess.invalidateAll();

    return transaction;
  }

  async update(
    id: string,
    updateModuleDto: UpdateModuleDto,
    adminId?: string,
    request?: any,
    moduleName?: string,
  ): Promise<any> {
    if (!id) {
      throw new BadRequestException(
        ErrorMessageHelper.getMultiLanguageMessage('MODULE_NOT_FOUND'),
      );
    }

    // check if data exists
    const module = await this.moduleModel.findOneIgnoreStatus(id);

    // soft-deleted rows count as not found (were a TypeError / 500)
    if (!module || module.deletedAt) {
      throw new BadRequestException(
        ErrorMessageHelper.getMultiLanguageMessage('MODULE_NOT_FOUND'),
      );
    }

    const transaction = await this.prisma.$transaction(async (tx) => {
      // update data
      const moduleData = await tx.module.findFirst({
        where: {
          id,
          deletedAt: null,
        },
      });

      const updatedModule = await tx.module.update({
        where: { id },
        data: {
          name: updateModuleDto.name ?? moduleData.name,
          isActive: updateModuleDto.isActive ?? moduleData.isActive,
          updatedAt: new Date(),
        },
      });

      // normalize data
      const normalizedData = {
        ...updatedModule,
      };

      return normalizedData;
    });

    // Log update action
    await this.helper.logAction(LogActions.UPDATE, {
      adminId,
      request,
      moduleName,
      targetId: transaction.id,
      notes: 'Update Module',
      valueBefore: module,
      valueAfter: transaction,
    });

    // RBAC data changed — drop cached admin permissions
    await this.adminAccess.invalidateAll();

    return transaction;
  }

  async delete(
    id: string,
    adminId?: string,
    request?: any,
    moduleName?: string,
  ): Promise<void> {
    if (!id) {
      throw new BadRequestException(
        ErrorMessageHelper.getMultiLanguageMessage('MODULE_NOT_FOUND'),
      );
    }

    // check if data exists
    const module = await this.moduleModel.findOneIgnoreStatus(id);

    // soft-deleted rows count as not found (were a TypeError / 500)
    if (!module || module.deletedAt) {
      throw new BadRequestException(
        ErrorMessageHelper.getMultiLanguageMessage('MODULE_NOT_FOUND'),
      );
    }

    await this.prisma.module.update({
      where: {
        id,
        deletedAt: null,
      },
      data: {
        deletedAt: new Date(),
      },
    });

    // Log delete action
    await this.helper.logAction(LogActions.DELETE, {
      adminId,
      request,
      moduleName,
      targetId: id,
      notes: 'Delete Module',
      valueBefore: module,
    });

    // RBAC data changed — drop cached admin permissions
    await this.adminAccess.invalidateAll();
  }

  async restore(
    id: string,
    adminId?: string,
    request?: any,
    moduleName?: string,
  ): Promise<any> {
    if (!id) {
      throw new BadRequestException(
        ErrorMessageHelper.getMultiLanguageMessage('MODULE_NOT_FOUND'),
      );
    }

    // check if data exists and is deleted
    const module = await this.prisma.module.findFirst({
      where: {
        id,
      },
    });

    if (!module) {
      throw new BadRequestException(
        ErrorMessageHelper.getMultiLanguageMessage('MODULE_NOT_FOUND'),
      );
    }

    if (module.deletedAt === null) {
      throw new BadRequestException(
        ErrorMessageHelper.getMultiLanguageMessage('MODULE_NOT_DELETED'),
      );
    }

    const transaction = await this.prisma.$transaction(async (tx) => {
      // restore data by setting deletedAt to null
      const restoredModule = await tx.module.update({
        where: { id },
        data: {
          deletedAt: null,
          updatedAt: new Date(),
        },
      });

      // normalize data
      const data = {
        ...restoredModule,
      };

      return data;
    });

    // Log restore action
    await this.helper.logAction(LogActions.RESTORE, {
      adminId,
      request,
      moduleName,
      targetId: id,
      notes: 'Restore Module',
    });

    // RBAC data changed — drop cached admin permissions
    await this.adminAccess.invalidateAll();

    return transaction;
  }
}
