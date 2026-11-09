import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { AdminAccessService } from 'src/common/auth/admin-access.service';
import { HelperService } from 'src/utils/helper.service';
import { DatatableType } from 'src/types/datatable';
import { CreateAdminDto, UpdateAdminDto } from './dto/admin.dto';
import { ErrorMessageHelper } from 'src/common/helpers/error-message.helper';
import { StorageService } from 'src/common/services/storage.service';
import { LogActions } from 'src/common/constants/log-actions';
import { PrismaService } from 'src/prisma/prisma.service';
import { AdminModel } from 'src/models';
import { isRootAdmin, ROOT_GROUP } from 'src/common/auth/rbac.helpers';
import type { AdminGroupDetail } from 'src/common/auth/admin-access.service';
import { assertEmailAvailable } from 'src/common/helpers/email.helper';

@Injectable()
export class AdminService {
  constructor(
    private readonly helper: HelperService,
    private readonly storageService: StorageService,
    private readonly adminAccess: AdminAccessService,
    private readonly prisma: PrismaService,
    private readonly adminModel: AdminModel,
  ) {}

  async findAll(datatable: DatatableType): Promise<any> {
    // get total from all data (with same filters as findAll)
    const totalCount = await this.adminModel.countAll(datatable);

    // query per page
    const admins = await this.adminModel.findAll(datatable);

    // normalize data per page
    const data = admins.map((admin) => ({
      ...admin,
      avatar: admin.avatar ? this.helper.generateFileUrl(admin.avatar) : null,
      password: undefined,
      adminGroups: admin.adminGroupMembers.map((member) => ({
        id: member.adminGroup.id,
        name: member.adminGroup.name,
      })),
      adminGroupMembers: undefined,
    }));

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
        ErrorMessageHelper.getMultiLanguageMessage('ADMIN_NOT_FOUND'),
      );
    }

    // get data
    const admin = await this.adminModel.findOneIgnoreStatus(id);

    if (!admin) {
      throw new BadRequestException(
        ErrorMessageHelper.getMultiLanguageMessage('ADMIN_NOT_FOUND'),
      );
    }

    // normalize data
    const data = {
      ...admin,
      avatar: admin.avatar ? this.helper.generateFileUrl(admin.avatar) : null,
      password: undefined,
      adminGroups: admin.adminGroupMembers.map((member) => ({
        id: member.adminGroup.id,
        name: member.adminGroup.name,
      })),
      adminGroupMembers: undefined,
    };

    // Log View action
    await this.helper.logAction(LogActions.VIEW, {
      adminId,
      request,
      moduleName,
      targetId: id,
      notes: 'View Admin Account Detail',
    });

    return data;
  }

  async checkUsernameExist(username: string): Promise<boolean> {
    const admin = await this.adminModel.findByUsernameIgnoreStatus(username);
    return !!admin;
  }

  async create(
    createAdminDto: CreateAdminDto,
    avatar?: Express.Multer.File,
    adminId?: string,
    request?: any,
    moduleName?: string,
  ): Promise<any> {
    await this.assertGroupAssignable(
      createAdminDto.adminGroupId,
      request?.user,
    );

    // Emails are unique (case-insensitive) — checked before any upload
    await assertEmailAvailable(this.prisma.admin, createAdminDto.email);

    const transaction = await this.storageService.withUpload(
      {
        file: avatar,
        options: {
          folder: 'avatar-admin',
          prefix: 'admin',
          identifier: createAdminDto.fullname,
        },
      },
      // new avatar uploaded first; the old one is deleted only after
      // the update commits, and the new one removed if it fails
      (avatarUrl) =>
        this.prisma.$transaction(async (tx) => {
          // create data
          const admin = await tx.admin.create({
            data: {
              fullname: createAdminDto.fullname,
              email: createAdminDto.email,
              phoneNumber: createAdminDto.phoneNumber,
              username: createAdminDto.username,
              password: createAdminDto.password,
              isActive: createAdminDto.isActive,
              avatar: avatarUrl,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          });

          // normalize data
          const data = {
            ...admin,
            avatar: admin.avatar
              ? this.helper.generateFileUrl(admin.avatar)
              : null,
            password: undefined,
          };

          // admin data successfully created, add the admin to the selected group
          // a deleted or inactive group would silently grant nothing
          const group = await tx.adminGroup.findFirst({
            where: {
              id: createAdminDto.adminGroupId,
              deletedAt: null,
              isActive: true,
            },
          });

          if (!group) {
            throw new BadRequestException(
              ErrorMessageHelper.getMultiLanguageMessage(
                'ADMIN_GROUP_NOT_FOUND',
              ),
            );
          }

          await tx.adminGroupMember.create({
            data: {
              adminId: admin.id,
              adminGroupId: group.id,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          });

          return data;
        }),
    );

    // Log creation action
    await this.helper.logAction(LogActions.ADD_NEW, {
      adminId,
      request,
      moduleName,
      targetId: transaction.id,
      notes: 'Add New Admin Account',
      valueAfter: transaction,
    });

    // RBAC data changed — drop cached admin permissions
    await this.adminAccess.invalidateAll();

    return transaction;
  }

  async update(
    id: string,
    updateAdminDto: UpdateAdminDto,
    avatar?: Express.Multer.File,
    adminId?: string,
    request?: any,
    moduleName?: string,
  ): Promise<any> {
    if (!id) {
      throw new BadRequestException(
        ErrorMessageHelper.getMultiLanguageMessage('ADMIN_NOT_FOUND'),
      );
    }

    // check if data exists
    const admin = await this.adminModel.findOneIgnoreStatus(id);

    // soft-deleted rows count as not found (were a TypeError / 500)
    if (!admin || admin.deletedAt) {
      throw new BadRequestException(
        ErrorMessageHelper.getMultiLanguageMessage('ADMIN_NOT_FOUND'),
      );
    }

    // Checked before anything changes (avatar replacement, sessions, ...)
    await this.assertCanManage(id, request?.user, {
      deactivating: updateAdminDto.isActive === false,
    });
    await this.assertGroupAssignable(
      updateAdminDto.adminGroupId,
      request?.user,
    );

    await assertEmailAvailable(this.prisma.admin, updateAdminDto.email, id);

    const transaction = await this.storageService.withUpload(
      {
        file: avatar,
        options: {
          folder: 'avatar-admin',
          prefix: 'admin',
          identifier: updateAdminDto.fullname || admin.fullname,
        },
        replaces: admin.avatar,
      },
      // new avatar uploaded first; the old one is deleted only after
      // the update commits, and the new one removed if it fails
      (avatarUrl) =>
        this.prisma.$transaction(async (tx) => {
          // update data
          const adminData = await tx.admin.findFirst({
            where: {
              id,
              deletedAt: null,
            },
          });

          const admin = await tx.admin.update({
            where: { id },
            data: {
              fullname: updateAdminDto.fullname ?? adminData.fullname,
              email: updateAdminDto.email ?? adminData.email,
              phoneNumber: updateAdminDto.phoneNumber ?? adminData.phoneNumber,
              password: updateAdminDto.password ?? adminData.password,
              isActive: updateAdminDto.isActive ?? adminData.isActive,
              avatar: avatarUrl ?? adminData.avatar,
              updatedAt: new Date(),
            },
          });

          // New password or deactivation: end every existing session for them.
          if (updateAdminDto.password || updateAdminDto.isActive === false) {
            await tx.adminRefreshToken.updateMany({
              where: { adminId: id, isRevoked: false },
              data: { isRevoked: true },
            });
          }

          // update admin group if provided
          if (updateAdminDto.adminGroupId) {
            // verify the group exists
            // a deleted or inactive group would silently grant nothing
            const group = await tx.adminGroup.findFirst({
              where: {
                id: updateAdminDto.adminGroupId,
                deletedAt: null,
                isActive: true,
              },
            });

            if (!group) {
              throw new BadRequestException(
                ErrorMessageHelper.getMultiLanguageMessage(
                  'ADMIN_GROUP_NOT_FOUND',
                ),
              );
            }

            // delete existing admin group memberships (excluding *root)
            await tx.adminGroupMember.deleteMany({
              where: {
                adminId: id,
                adminGroup: {
                  name: { not: '*root' },
                },
              },
            });

            // create the membership (upsert: assigning a group the admin is
            // already in — e.g. *root, kept above — must not hit the unique key)
            await tx.adminGroupMember.upsert({
              where: {
                adminId_adminGroupId: {
                  adminId: id,
                  adminGroupId: updateAdminDto.adminGroupId,
                },
              },
              update: { updatedAt: new Date() },
              create: {
                adminId: id,
                adminGroupId: updateAdminDto.adminGroupId,
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            });
          }

          // normalize data
          const data = {
            ...admin,
            avatar: admin.avatar
              ? this.helper.generateFileUrl(admin.avatar)
              : null,
            password: undefined,
          };

          return data;
        }),
    );

    // Log update action
    await this.helper.logAction(LogActions.UPDATE, {
      adminId,
      request,
      moduleName,
      targetId: transaction.id,
      notes: 'Update Admin Account',
      valueBefore: admin,
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
        ErrorMessageHelper.getMultiLanguageMessage('ADMIN_NOT_FOUND'),
      );
    }

    // check if data exists
    const admin = await this.adminModel.findOneIgnoreStatus(id);

    // soft-deleted rows count as not found (were a TypeError / 500)
    if (!admin || admin.deletedAt) {
      throw new BadRequestException(
        ErrorMessageHelper.getMultiLanguageMessage('ADMIN_NOT_FOUND'),
      );
    }

    await this.assertCanManage(id, request?.user, { deleting: true });

    await this.prisma.$transaction([
      this.prisma.admin.update({
        where: {
          id,
          deletedAt: null,
        },
        data: {
          deletedAt: new Date(),
        },
      }),
      // a deleted admin must not stay signed in on any device
      this.prisma.adminRefreshToken.updateMany({
        where: { adminId: id, isRevoked: false },
        data: { isRevoked: true },
      }),
    ]);

    // Log delete action
    await this.helper.logAction(LogActions.DELETE, {
      adminId,
      request,
      moduleName,
      targetId: id,
      notes: 'Delete Admin Account',
      valueBefore: admin,
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
        ErrorMessageHelper.getMultiLanguageMessage('ADMIN_NOT_FOUND'),
      );
    }

    // check if data exists and is deleted
    const admin = await this.prisma.admin.findFirst({
      where: {
        id,
      },
    });

    if (!admin) {
      throw new BadRequestException(
        ErrorMessageHelper.getMultiLanguageMessage('ADMIN_NOT_FOUND'),
      );
    }

    if (admin.deletedAt === null) {
      throw new BadRequestException(
        ErrorMessageHelper.getMultiLanguageMessage('ADMIN_NOT_DELETED'),
      );
    }

    await this.assertCanManage(id, request?.user, {});

    const transaction = await this.prisma.$transaction(async (tx) => {
      // restore data by setting deletedAt to null
      const restoredAdmin = await tx.admin.update({
        where: { id },
        data: {
          deletedAt: null,
          updatedAt: new Date(),
        },
      });

      // normalize data
      const data = {
        ...restoredAdmin,
        avatar: restoredAdmin.avatar
          ? this.helper.generateFileUrl(restoredAdmin.avatar)
          : null,
        password: undefined,
      };

      return data;
    });

    // Log restore action
    await this.helper.logAction(LogActions.RESTORE, {
      adminId,
      request,
      moduleName,
      targetId: id,
      notes: 'Restore Admin Account',
    });

    // RBAC data changed — drop cached admin permissions
    await this.adminAccess.invalidateAll();

    return transaction;
  }

  /**
   * Guards admin-account changes against privilege abuse:
   * - only a root admin may change, delete or restore a root admin
   *   (otherwise "Edit" could reset the superadmin's password or email);
   * - nobody can delete or deactivate their own account;
   * - the last active root admin can't be deleted or deactivated.
   */
  private async assertCanManage(
    targetId: string,
    caller: { id?: string; adminGroupDetail?: AdminGroupDetail } | undefined,
    change: { deleting?: boolean; deactivating?: boolean },
  ): Promise<void> {
    const isSelf = !!caller?.id && caller.id === targetId;
    if (change.deleting && isSelf) {
      throw new BadRequestException(
        ErrorMessageHelper.getMultiLanguageMessage('CANNOT_DELETE_SELF'),
      );
    }
    if (change.deactivating && isSelf) {
      throw new BadRequestException(
        ErrorMessageHelper.getMultiLanguageMessage('CANNOT_DEACTIVATE_SELF'),
      );
    }

    const targetIsRoot = !!(await this.prisma.adminGroupMember.findFirst({
      where: { adminId: targetId, adminGroup: { name: ROOT_GROUP } },
      select: { id: true },
    }));
    if (!targetIsRoot) return;

    if (!isRootAdmin(caller)) {
      throw new ForbiddenException(
        ErrorMessageHelper.getMultiLanguageMessage('ROOT_ADMIN_PROTECTED'),
      );
    }
    if (change.deleting || change.deactivating) {
      const otherActiveRoots = await this.prisma.adminGroupMember.count({
        where: {
          adminId: { not: targetId },
          adminGroup: { name: ROOT_GROUP, deletedAt: null },
          admin: { deletedAt: null, isActive: true },
        },
      });
      if (otherActiveRoots === 0) {
        throw new BadRequestException(
          ErrorMessageHelper.getMultiLanguageMessage('LAST_ROOT_ADMIN'),
        );
      }
    }
  }

  // Only a root admin may put someone into the *root group.
  private async assertGroupAssignable(
    adminGroupId: string | undefined,
    caller: { adminGroupDetail?: AdminGroupDetail } | undefined,
  ): Promise<void> {
    if (!adminGroupId || isRootAdmin(caller)) return;
    const group = await this.prisma.adminGroup.findUnique({
      where: { id: adminGroupId },
      select: { name: true },
    });
    if (group?.name === ROOT_GROUP) {
      throw new ForbiddenException(
        ErrorMessageHelper.getMultiLanguageMessage(
          'ROOT_GROUP_ASSIGN_FORBIDDEN',
        ),
      );
    }
  }
}
