import { BadRequestException, Injectable } from '@nestjs/common';
import { AdminAccessService } from 'src/common/auth/admin-access.service';
import { HelperService } from 'src/utils/helper.service';
import { DatatableType } from 'src/types/datatable';
import {
  CreateAdminGroupDto,
  UpdateAdminGroupDto,
} from './dto/admin-group.dto';
import { ErrorMessageHelper } from 'src/common/helpers/error-message.helper';
import { LogActions } from 'src/common/constants/log-actions';
import { PrismaService } from 'src/prisma/prisma.service';
import { AdminGroupModel } from 'src/models';
import { assertCanGrantRules } from 'src/common/auth/rbac.helpers';

@Injectable()
export class AdminGroupService {
  constructor(
    private readonly helper: HelperService,
    private readonly adminAccess: AdminAccessService,
    private readonly prisma: PrismaService,
    private readonly adminGroupModel: AdminGroupModel,
  ) {}

  async findAll(datatable: DatatableType): Promise<any> {
    // get total from all data (with same filters as findAll)
    const totalCount = await this.adminGroupModel.countAll(datatable);

    // query per page
    const adminGroups = await this.adminGroupModel.findAll(datatable);

    // normalize data per page
    const data = adminGroups.map((adminGroup) => {
      // Group access rules by module
      const moduleMap = new Map();

      (adminGroup.modules || []).forEach((access) => {
        const moduleId = access.moduleRule.module.id;

        if (!moduleMap.has(moduleId)) {
          moduleMap.set(moduleId, {
            id: access.moduleRule.module.id,
            name: access.moduleRule.module.name,
            rules: [],
          });
        }

        moduleMap.get(moduleId).rules.push({
          id: access.moduleRule.id,
          name: access.moduleRule.name,
        });
      });

      return {
        ...adminGroup,
      };
    });

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
        ErrorMessageHelper.getMultiLanguageMessage('ADMIN_GROUP_NOT_FOUND'),
      );
    }

    // get data
    const adminGroup = await this.adminGroupModel.findOneIgnoreStatus(id);

    if (!adminGroup) {
      throw new BadRequestException(
        ErrorMessageHelper.getMultiLanguageMessage('ADMIN_GROUP_NOT_FOUND'),
      );
    }

    // Group access rules by module (same structure as login)
    const moduleMap = new Map();

    (adminGroup.modules || []).forEach((access) => {
      const moduleId = access.moduleRule.module.id;

      if (!moduleMap.has(moduleId)) {
        moduleMap.set(moduleId, {
          id: access.moduleRule.module.id,
          name: access.moduleRule.module.name,
          rules: [],
        });
      }

      moduleMap.get(moduleId).rules.push({
        id: access.moduleRule.id,
        name: access.moduleRule.name,
      });
    });

    const data = {
      ...adminGroup,
      members: (adminGroup.admins || []).map((member) => ({
        id: member.admin.id,
        fullname: member.admin.fullname,
        username: member.admin.username,
        email: member.admin.email,
      })),
      admins: undefined,
      moduleRules: Array.from(moduleMap.values()),
      modules: undefined,
    };

    // Log View action
    await this.helper.logAction(LogActions.VIEW, {
      adminId,
      request,
      moduleName,
      targetId: id,
      notes: 'View Admin Group Detail',
    });

    return data;
  }

  async checkNameExist(name: string): Promise<boolean> {
    const adminGroup = await this.adminGroupModel.findByNameIgnoreStatus(name);
    return !!adminGroup;
  }

  async create(
    createAdminGroupDto: CreateAdminGroupDto,
    adminId?: string,
    request?: any,
    moduleName?: string,
  ): Promise<any> {
    // Non-root admins can't grant rules they don't hold themselves
    assertCanGrantRules(request?.user, createAdminGroupDto.moduleRuleIds);

    // validate moduleRuleIds if provided
    if (createAdminGroupDto.moduleRuleIds?.length > 0) {
      const existingRules = await this.prisma.moduleRule.findMany({
        where: {
          id: { in: createAdminGroupDto.moduleRuleIds },
          deletedAt: null,
        },
        select: { id: true },
      });
      if (existingRules.length !== createAdminGroupDto.moduleRuleIds.length) {
        throw new BadRequestException(
          ErrorMessageHelper.getMultiLanguageMessage('MODULE_RULE_NOT_FOUND'),
        );
      }
    }

    const transaction = await this.prisma.$transaction(async (tx) => {
      // create data
      const adminGroup = await tx.adminGroup.create({
        data: {
          name: createAdminGroupDto.name,
          isActive: createAdminGroupDto.isActive ?? true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      // create access records
      if (createAdminGroupDto.moduleRuleIds?.length > 0) {
        await tx.adminGroupAccess.createMany({
          data: createAdminGroupDto.moduleRuleIds.map((moduleRuleId) => ({
            adminGroupId: adminGroup.id,
            moduleRuleId,
            createdAt: new Date(),
            updatedAt: new Date(),
          })),
        });
      }

      const access = await tx.adminGroupAccess.findMany({
        where: { adminGroupId: adminGroup.id },
        include: {
          moduleRule: {
            select: {
              id: true,
              name: true,
              module: { select: { id: true, name: true } },
            },
          },
        },
      });

      return { ...adminGroup, access };
    });

    // Log creation action
    await this.helper.logAction(LogActions.ADD_NEW, {
      adminId,
      request,
      moduleName,
      targetId: transaction.id,
      notes: 'Add New Admin Group',
      valueAfter: transaction,
    });

    // RBAC data changed — drop cached admin permissions
    await this.adminAccess.invalidateAll();

    return transaction;
  }

  async update(
    id: string,
    updateAdminGroupDto: UpdateAdminGroupDto,
    adminId?: string,
    request?: any,
    moduleName?: string,
  ): Promise<any> {
    if (!id) {
      throw new BadRequestException(
        ErrorMessageHelper.getMultiLanguageMessage('ADMIN_GROUP_NOT_FOUND'),
      );
    }

    // check if data exists
    const adminGroup = await this.adminGroupModel.findOneIgnoreStatus(id);

    // soft-deleted rows count as not found (were a TypeError / 500)
    if (!adminGroup || adminGroup.deletedAt) {
      throw new BadRequestException(
        ErrorMessageHelper.getMultiLanguageMessage('ADMIN_GROUP_NOT_FOUND'),
      );
    }

    // Non-root admins can't add rules they don't hold themselves (rules the
    // group already has may be kept or removed).
    const existingAccess = await this.prisma.adminGroupAccess.findMany({
      where: { adminGroupId: id },
      select: { moduleRuleId: true },
    });
    assertCanGrantRules(
      request?.user,
      updateAdminGroupDto.moduleRuleIds,
      existingAccess.map((a) => a.moduleRuleId),
    );

    // validate moduleRuleIds if provided
    if (updateAdminGroupDto.moduleRuleIds?.length > 0) {
      const existingRules = await this.prisma.moduleRule.findMany({
        where: {
          id: { in: updateAdminGroupDto.moduleRuleIds },
          deletedAt: null,
        },
        select: { id: true },
      });
      if (existingRules.length !== updateAdminGroupDto.moduleRuleIds.length) {
        throw new BadRequestException(
          ErrorMessageHelper.getMultiLanguageMessage('MODULE_RULE_NOT_FOUND'),
        );
      }
    }

    const transaction = await this.prisma.$transaction(async (tx) => {
      // update data
      const adminGroupData = await tx.adminGroup.findFirst({
        where: {
          id,
          deletedAt: null,
        },
      });

      const updatedAdminGroup = await tx.adminGroup.update({
        where: { id },
        data: {
          name: updateAdminGroupDto.name ?? adminGroupData.name,
          isActive: updateAdminGroupDto.isActive ?? adminGroupData.isActive,
          updatedAt: new Date(),
        },
      });

      // Replace access only when moduleRuleIds is sent: omitted = keep the
      // current rules (a name-only update used to wipe them), [] = clear.
      if (updateAdminGroupDto.moduleRuleIds !== undefined) {
        await tx.adminGroupAccess.deleteMany({ where: { adminGroupId: id } });
        if (updateAdminGroupDto.moduleRuleIds.length > 0) {
          await tx.adminGroupAccess.createMany({
            data: updateAdminGroupDto.moduleRuleIds.map((moduleRuleId) => ({
              adminGroupId: id,
              moduleRuleId,
              createdAt: new Date(),
              updatedAt: new Date(),
            })),
          });
        }
      }

      const access = await tx.adminGroupAccess.findMany({
        where: { adminGroupId: id },
        include: {
          moduleRule: {
            select: {
              id: true,
              name: true,
              module: { select: { id: true, name: true } },
            },
          },
        },
      });

      return { ...updatedAdminGroup, access };
    });

    // Log update action
    await this.helper.logAction(LogActions.UPDATE, {
      adminId,
      request,
      moduleName,
      targetId: transaction.id,
      notes: 'Update Admin Group',
      valueBefore: adminGroup,
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
        ErrorMessageHelper.getMultiLanguageMessage('ADMIN_GROUP_NOT_FOUND'),
      );
    }

    // check if data exists
    const adminGroup = await this.adminGroupModel.findOneIgnoreStatus(id);

    // soft-deleted rows count as not found (were a TypeError / 500)
    if (!adminGroup || adminGroup.deletedAt) {
      throw new BadRequestException(
        ErrorMessageHelper.getMultiLanguageMessage('ADMIN_GROUP_NOT_FOUND'),
      );
    }

    await this.prisma.adminGroup.update({
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
      notes: 'Delete Admin Group',
      valueBefore: adminGroup,
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
        ErrorMessageHelper.getMultiLanguageMessage('ADMIN_GROUP_NOT_FOUND'),
      );
    }

    // check if data exists and is deleted
    const adminGroup = await this.prisma.adminGroup.findFirst({
      where: {
        id,
      },
    });

    if (!adminGroup) {
      throw new BadRequestException(
        ErrorMessageHelper.getMultiLanguageMessage('ADMIN_GROUP_NOT_FOUND'),
      );
    }

    if (adminGroup.deletedAt === null) {
      throw new BadRequestException(
        ErrorMessageHelper.getMultiLanguageMessage('ADMIN_GROUP_NOT_DELETED'),
      );
    }

    const transaction = await this.prisma.$transaction(async (tx) => {
      // restore data by setting deletedAt to null
      const restoredAdminGroup = await tx.adminGroup.update({
        where: { id },
        data: {
          deletedAt: null,
          updatedAt: new Date(),
        },
      });

      // normalize data
      const data = {
        ...restoredAdminGroup,
      };

      return data;
    });

    // Log restore action
    await this.helper.logAction(LogActions.RESTORE, {
      adminId,
      request,
      moduleName,
      targetId: id,
      notes: 'Restore Admin Group',
    });

    // RBAC data changed — drop cached admin permissions
    await this.adminAccess.invalidateAll();

    return transaction;
  }
}
