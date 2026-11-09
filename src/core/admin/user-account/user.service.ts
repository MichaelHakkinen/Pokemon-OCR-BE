import { BadRequestException, Injectable } from '@nestjs/common';
import { HelperService } from 'src/utils/helper.service';
import { DatatableType } from 'src/types/datatable';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';
import { ErrorMessageHelper } from 'src/common/helpers/error-message.helper';
import { StorageService } from 'src/common/services/storage.service';
import { LogActions } from 'src/common/constants/log-actions';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserModel } from 'src/models';
import { assertEmailAvailable } from 'src/common/helpers/email.helper';

@Injectable()
export class UserService {
  constructor(
    private readonly helper: HelperService,
    private readonly storageService: StorageService,
    private readonly prisma: PrismaService,
    private readonly userModel: UserModel,
  ) {}

  async findAll(datatable: DatatableType): Promise<any> {
    // get total from all data (with same filters as findAll)
    const totalCount = await this.userModel.countAll(datatable);

    // query per page
    const users = await this.userModel.findAll(datatable);

    // normalize data per page
    const data = users.map((user) => ({
      ...user,
      avatar: user.avatar ? this.helper.generateFileUrl(user.avatar) : null,
      password: undefined,
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
        ErrorMessageHelper.getMultiLanguageMessage('USER_NOT_FOUND'),
      );
    }

    // get data
    const user = await this.userModel.findOneIgnoreStatus(id);

    if (!user) {
      throw new BadRequestException(
        ErrorMessageHelper.getMultiLanguageMessage('USER_NOT_FOUND'),
      );
    }

    // normalize data
    const data = {
      ...user,
      avatar: user.avatar ? this.helper.generateFileUrl(user.avatar) : null,
      password: undefined,
    };

    // Log View action
    await this.helper.logAction(LogActions.VIEW, {
      adminId,
      request,
      moduleName,
      targetId: id,
      notes: 'View User Account Detail',
    });

    return data;
  }

  async checkUsernameExist(username: string): Promise<boolean> {
    const user = await this.userModel.findByUsernameIgnoreStatus(username);
    return !!user;
  }

  async create(
    createUserDto: CreateUserDto,
    avatar?: Express.Multer.File,
    adminId?: string,
    request?: any,
    moduleName?: string,
  ): Promise<any> {
    // Emails are unique (case-insensitive) — checked before any upload
    await assertEmailAvailable(this.prisma.user, createUserDto.email);

    const transaction = await this.storageService.withUpload(
      {
        file: avatar,
        options: {
          folder: 'avatar-user',
          prefix: 'user',
          identifier: createUserDto.fullname,
        },
      },
      // new avatar uploaded first; the old one is deleted only after
      // the update commits, and the new one removed if it fails
      (avatarUrl) =>
        this.prisma.$transaction(async (tx) => {
          // create data
          const user = await tx.user.create({
            data: {
              fullname: createUserDto.fullname,
              email: createUserDto.email,
              phoneNumber: createUserDto.phoneNumber,
              username: createUserDto.username,
              password: createUserDto.password,
              isActive: createUserDto.isActive,
              avatar: avatarUrl,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          });

          // normalize data
          const data = {
            ...user,
            avatar: user.avatar
              ? this.helper.generateFileUrl(user.avatar)
              : null,
            password: undefined,
          };

          return data;
        }),
    );

    // Log creation action
    await this.helper.logAction(LogActions.ADD_NEW, {
      adminId,
      request,
      moduleName,
      targetId: transaction.id,
      notes: 'Add New User Account',
      valueAfter: transaction,
    });

    return transaction;
  }

  async update(
    id: string,
    updateUserDto: UpdateUserDto,
    avatar?: Express.Multer.File,
    adminId?: string,
    request?: any,
    moduleName?: string,
  ): Promise<any> {
    if (!id) {
      throw new BadRequestException(
        ErrorMessageHelper.getMultiLanguageMessage('USER_NOT_FOUND'),
      );
    }

    // check if data exists
    const user = await this.userModel.findOneIgnoreStatus(id);

    // soft-deleted rows count as not found (were a TypeError / 500)
    if (!user || user.deletedAt) {
      throw new BadRequestException(
        ErrorMessageHelper.getMultiLanguageMessage('USER_NOT_FOUND'),
      );
    }

    await assertEmailAvailable(this.prisma.user, updateUserDto.email, id);

    const transaction = await this.storageService.withUpload(
      {
        file: avatar,
        options: {
          folder: 'avatar-user',
          prefix: 'user',
          identifier: updateUserDto.fullname || user.fullname,
        },
        replaces: user.avatar,
      },
      // new avatar uploaded first; the old one is deleted only after
      // the update commits, and the new one removed if it fails
      (avatarUrl) =>
        this.prisma.$transaction(async (tx) => {
          // update data
          const userData = await tx.user.findFirst({
            where: {
              id,
              deletedAt: null,
            },
          });

          const user = await tx.user.update({
            where: { id },
            data: {
              fullname: updateUserDto.fullname ?? userData.fullname,
              email: updateUserDto.email ?? userData.email,
              phoneNumber: updateUserDto.phoneNumber ?? userData.phoneNumber,
              password: updateUserDto.password ?? userData.password,
              isActive: updateUserDto.isActive ?? userData.isActive,
              avatar: avatarUrl ?? userData.avatar,
              updatedAt: new Date(),
            },
          });

          // New password or deactivation: end every existing session for them.
          if (updateUserDto.password || updateUserDto.isActive === false) {
            await tx.userRefreshToken.updateMany({
              where: { userId: id, isRevoked: false },
              data: { isRevoked: true },
            });
          }

          // normalize data
          const data = {
            ...user,
            avatar: user.avatar
              ? this.helper.generateFileUrl(user.avatar)
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
      notes: 'Update User Account',
      valueBefore: user,
      valueAfter: transaction,
    });

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
        ErrorMessageHelper.getMultiLanguageMessage('USER_NOT_FOUND'),
      );
    }

    // check if data exists
    const user = await this.userModel.findOneIgnoreStatus(id);

    // soft-deleted rows count as not found (were a TypeError / 500)
    if (!user || user.deletedAt) {
      throw new BadRequestException(
        ErrorMessageHelper.getMultiLanguageMessage('USER_NOT_FOUND'),
      );
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: {
          id,
          deletedAt: null,
        },
        data: {
          deletedAt: new Date(),
        },
      }),
      // a deleted user must not stay signed in on any device
      this.prisma.userRefreshToken.updateMany({
        where: { userId: id, isRevoked: false },
        data: { isRevoked: true },
      }),
    ]);

    // Log delete action
    await this.helper.logAction(LogActions.DELETE, {
      adminId,
      request,
      moduleName,
      targetId: id,
      notes: 'Delete User Account',
      valueBefore: user,
    });
  }

  async restore(
    id: string,
    adminId?: string,
    request?: any,
    moduleName?: string,
  ): Promise<any> {
    if (!id) {
      throw new BadRequestException(
        ErrorMessageHelper.getMultiLanguageMessage('USER_NOT_FOUND'),
      );
    }

    // check if data exists and is deleted
    const user = await this.prisma.user.findFirst({
      where: {
        id,
      },
    });

    if (!user) {
      throw new BadRequestException(
        ErrorMessageHelper.getMultiLanguageMessage('USER_NOT_FOUND'),
      );
    }

    if (user.deletedAt === null) {
      throw new BadRequestException(
        ErrorMessageHelper.getMultiLanguageMessage('USER_NOT_DELETED'),
      );
    }

    const transaction = await this.prisma.$transaction(async (tx) => {
      // restore data by setting deletedAt to null
      const restoredUser = await tx.user.update({
        where: { id },
        data: {
          deletedAt: null,
          updatedAt: new Date(),
        },
      });

      // normalize data
      const data = {
        ...restoredUser,
        avatar: restoredUser.avatar
          ? this.helper.generateFileUrl(restoredUser.avatar)
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
      notes: 'Restore User Account',
    });

    return transaction;
  }
}
