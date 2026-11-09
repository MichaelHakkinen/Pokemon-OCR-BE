import { BadRequestException, Injectable } from '@nestjs/common';
import { AdminAccessService } from 'src/common/auth/admin-access.service';
import { ErrorMessageHelper } from 'src/common/helpers/error-message.helper';
import { DatatableType } from 'src/types/datatable';
import { HelperService } from 'src/utils/helper.service';
import {
  CreateModuleRuleDto,
  UpdateModuleRuleDto,
} from './dto/module-rule.dto';
import { LogActions } from 'src/common/constants/log-actions';
import { PrismaService } from 'src/prisma/prisma.service';
import { ModuleRuleModel } from 'src/models';

@Injectable()
export class ModuleRuleService {
  constructor(
    private readonly helper: HelperService,
    private readonly adminAccess: AdminAccessService,
    private readonly prisma: PrismaService,
    private readonly moduleRuleModel: ModuleRuleModel,
  ) {}

  async findAll(datatable: DatatableType): Promise<any> {
    // get total from all data (with same filters as findAll)
    const totalCount = await this.moduleRuleModel.countAll(datatable);

    // query per page
    const data = await this.moduleRuleModel.findAll(datatable);

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
        ErrorMessageHelper.getMultiLanguageMessage('MODULE_RULE_NOT_FOUND'),
      );
    }

    // get data
    const data = await this.moduleRuleModel.findOneIgnoreStatus(id);

    if (!data) {
      throw new BadRequestException(
        ErrorMessageHelper.getMultiLanguageMessage('MODULE_RULE_NOT_FOUND'),
      );
    }

    // Log View action
    await this.helper.logAction(LogActions.VIEW, {
      adminId,
      request,
      moduleName,
      targetId: id,
      notes: 'View Module Rule Detail',
    });

    return data;
  }

  async checkNameExist(name: string, moduleId: string): Promise<boolean> {
    const data = await this.moduleRuleModel.findByNameIgnoreStatus(
      name,
      moduleId,
    );
    return !!data;
  }

  async create(
    createModuleRuleDto: CreateModuleRuleDto,
    adminId?: string,
    request?: any,
    moduleName?: string,
  ): Promise<any> {
    const transaction = await this.prisma.$transaction(async (tx) => {
      // get module data
      const moduleData = await tx.module.findFirst({
        where: {
          id: createModuleRuleDto.moduleId,
          deletedAt: null,
        },
      });
      if (!moduleData) {
        throw new BadRequestException(
          ErrorMessageHelper.getMultiLanguageMessage('MODULE_NOT_FOUND'),
        );
      }

      // create the description
      const makeDesc = (ruleName: string) =>
        `User can ${ruleName} the ${moduleData.name} data`;

      // if isPackage is true, create multiple module rules
      if (createModuleRuleDto.isPackage) {
        const ruleNames = [
          'View List',
          'View Details',
          'Add New',
          'Edit',
          'Delete',
          'Restore',
        ];

        const created: any[] = [];
        const skipped: string[] = [];
        for (const ruleName of ruleNames) {
          // Skip rules that already exist, soft-deleted ones included: the
          // unique key (moduleId, name) covers them, so creating would fail,
          // and a deleted rule was deleted on purpose.
          const existingRule = await tx.moduleRule.findFirst({
            where: {
              moduleId: createModuleRuleDto.moduleId,
              name: ruleName,
            },
          });

          if (existingRule) {
            skipped.push(ruleName);
            continue;
          }

          const newRule = await tx.moduleRule.create({
            data: {
              moduleId: createModuleRuleDto.moduleId,
              name: ruleName,
              description: makeDesc(ruleName),
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          });
          created.push(newRule);
        }

        return {
          moduleId: moduleData.id,
          createdCount: created.length,
          skipped,
          data: created,
        };
      }

      // create single module rule
      const data = await tx.moduleRule.create({
        data: {
          moduleId: moduleData.id,
          name: createModuleRuleDto.name,
          description:
            createModuleRuleDto.description ??
            makeDesc(createModuleRuleDto.name),
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
    const targetId =
      'id' in transaction ? transaction.id : transaction.moduleId;
    await this.helper.logAction(LogActions.ADD_NEW, {
      adminId,
      request,
      moduleName,
      targetId,
      notes: 'Add New Module Rule',
      valueAfter: transaction,
    });

    // RBAC data changed — drop cached admin permissions
    await this.adminAccess.invalidateAll();

    return transaction;
  }

  async update(
    id: string,
    updateModuleRuleDto: UpdateModuleRuleDto,
    adminId?: string,
    request?: any,
    moduleName?: string,
  ): Promise<any> {
    if (!id) {
      throw new BadRequestException(
        ErrorMessageHelper.getMultiLanguageMessage('MODULE_RULE_NOT_FOUND'),
      );
    }

    // check if data exists
    const moduleRule = await this.moduleRuleModel.findOneIgnoreStatus(id);
    // soft-deleted rows count as not found (were a TypeError / 500)
    if (!moduleRule || moduleRule.deletedAt) {
      throw new BadRequestException(
        ErrorMessageHelper.getMultiLanguageMessage('MODULE_RULE_NOT_FOUND'),
      );
    }

    // update data
    const transaction = await this.prisma.$transaction(async (tx) => {
      const data = await tx.moduleRule.update({
        where: {
          id,
        },
        data: {
          name: updateModuleRuleDto.name,
          description: updateModuleRuleDto.description,
          updatedAt: new Date(),
        },
      });

      // normalize data
      const normalizedData = {
        ...data,
      };
      return normalizedData;
    });

    // Log update action
    await this.helper.logAction(LogActions.UPDATE, {
      adminId,
      request,
      moduleName,
      targetId: transaction.id,
      notes: 'Update Module Rule',
      valueBefore: moduleRule,
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
  ): Promise<any> {
    if (!id) {
      throw new BadRequestException(
        ErrorMessageHelper.getMultiLanguageMessage('MODULE_RULE_NOT_FOUND'),
      );
    }

    // check if data exists
    const moduleRule = await this.moduleRuleModel.findOneIgnoreStatus(id);
    // soft-deleted rows count as not found (were a TypeError / 500)
    if (!moduleRule || moduleRule.deletedAt) {
      throw new BadRequestException(
        ErrorMessageHelper.getMultiLanguageMessage('MODULE_RULE_NOT_FOUND'),
      );
    }

    // delete data
    const transaction = await this.prisma.$transaction(async (tx) => {
      const data = await tx.moduleRule.update({
        where: {
          id,
        },
        data: {
          deletedAt: new Date(),
        },
      });
      return data;
    });

    // Log delete action
    await this.helper.logAction(LogActions.DELETE, {
      adminId,
      request,
      moduleName,
      targetId: id,
      notes: 'Delete Module Rule',
      valueBefore: moduleRule,
    });

    // RBAC data changed — drop cached admin permissions
    await this.adminAccess.invalidateAll();

    return transaction;
  }

  async restore(
    id: string,
    adminId?: string,
    request?: any,
    moduleName?: string,
  ): Promise<any> {
    if (!id) {
      throw new BadRequestException(
        ErrorMessageHelper.getMultiLanguageMessage('MODULE_RULE_NOT_FOUND'),
      );
    }

    // check if data exists and is deleted
    const moduleRule = await this.prisma.moduleRule.findFirst({
      where: {
        id,
      },
    });

    if (!moduleRule) {
      throw new BadRequestException(
        ErrorMessageHelper.getMultiLanguageMessage('MODULE_RULE_NOT_FOUND'),
      );
    }

    if (moduleRule.deletedAt === null) {
      throw new BadRequestException(
        ErrorMessageHelper.getMultiLanguageMessage('MODULE_RULE_NOT_DELETED'),
      );
    }

    const transaction = await this.prisma.$transaction(async (tx) => {
      // restore data by setting deletedAt to null
      const restoredModuleRule = await tx.moduleRule.update({
        where: { id },
        data: {
          deletedAt: null,
          updatedAt: new Date(),
        },
      });

      // normalize data
      const data = {
        ...restoredModuleRule,
      };

      return data;
    });

    // Log restore action
    await this.helper.logAction(LogActions.RESTORE, {
      adminId,
      request,
      moduleName,
      targetId: id,
      notes: 'Restore Module Rule',
    });

    // RBAC data changed — drop cached admin permissions
    await this.adminAccess.invalidateAll();

    return transaction;
  }
}
