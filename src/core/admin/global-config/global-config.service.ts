import { Injectable, BadRequestException } from '@nestjs/common';
import { HelperService } from 'src/utils/helper.service';
import { RedisService } from 'src/common/services/redis.service';
import { LogActions } from 'src/common/constants/log-actions';
import { DatatableType } from 'src/types/datatable';
import { ErrorMessageHelper } from 'src/common/helpers/error-message.helper';
import {
  CreateGlobalConfigDto,
  UpdateGlobalConfigDto,
} from './dto/global-config.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { GlobalConfigModel } from 'src/models';

// Keys whose values are cached in Redis — invalidated on create/update/delete
const CACHED_GLOBAL_CONFIG_KEYS = [
  'IS_MOBILE_MAINTENANCE',
  'IS_WEBSITE_MAINTENANCE',
  'ANDROID_MIN_VERSION',
  'IOS_MIN_VERSION',
];

@Injectable()
export class GlobalConfigService {
  constructor(
    private readonly helper: HelperService,
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
    private readonly globalConfigModel: GlobalConfigModel,
  ) {}

  async findAll(datatable: DatatableType): Promise<any> {
    const totalCount = await this.globalConfigModel.countAll(datatable);
    const data = await this.globalConfigModel.findAll(datatable);
    const currentPage = datatable.page;
    // 0 for an empty page (e.g. page past the end), like the other lists
    const lowestNumber = data.length > 0 ? datatable.offset + 1 : 0;
    const highestNumber = Math.min(
      datatable.offset + datatable.limit,
      totalCount,
    );

    return {
      pagination: { totalCount, currentPage, lowestNumber, highestNumber },
      data,
    };
  }

  async findOne(
    id: string,
    adminId?: string,
    request?: any,
    moduleName?: string,
  ): Promise<any> {
    if (!id)
      throw new BadRequestException(
        ErrorMessageHelper.getMultiLanguageMessage('GLOBAL_CONFIG_NOT_FOUND'),
      );
    const data = await this.globalConfigModel.findOne(id);
    if (!data)
      throw new BadRequestException(
        ErrorMessageHelper.getMultiLanguageMessage('GLOBAL_CONFIG_NOT_FOUND'),
      );
    await this.helper.logAction(LogActions.VIEW, {
      adminId,
      request,
      moduleName,
      targetId: id,
    });
    return data;
  }

  async create(
    createDto: CreateGlobalConfigDto,
    adminId?: string,
    request?: any,
    moduleName?: string,
  ): Promise<any> {
    const existing = await this.prisma.globalConfig.findFirst({
      where: { key: createDto.key },
    });
    if (existing)
      throw new BadRequestException(
        ErrorMessageHelper.getMultiLanguageMessage(
          'GLOBAL_CONFIG_KEY_ALREADY_EXISTS',
        ),
      );

    const created = await this.prisma.$transaction(async (tx) => {
      return await tx.globalConfig.create({
        data: {
          key: createDto.key,
          value: createDto.value ?? null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
    });

    await this.helper.logAction(LogActions.ADD_NEW, {
      adminId,
      request,
      moduleName,
      targetId: created.id,
      valueAfter: created,
    });

    // A cached "missing" value for this key would otherwise hide it.
    if (CACHED_GLOBAL_CONFIG_KEYS.includes(created.key)) {
      await this.redis.del(`global_config:${created.key}`);
    }
    return created;
  }

  async update(
    id: string,
    updateDto: UpdateGlobalConfigDto,
    adminId?: string,
    request?: any,
    moduleName?: string,
  ): Promise<any> {
    const existing = await this.globalConfigModel.findOne(id);
    if (!existing)
      throw new BadRequestException(
        ErrorMessageHelper.getMultiLanguageMessage('GLOBAL_CONFIG_NOT_FOUND'),
      );

    const updated = await this.prisma.$transaction(async (tx) => {
      return await tx.globalConfig.update({
        where: { id },
        data: { value: updateDto.value ?? null, updatedAt: new Date() },
      });
    });

    if (CACHED_GLOBAL_CONFIG_KEYS.includes(existing.key)) {
      await this.redis.del(`global_config:${existing.key}`);
    }

    await this.helper.logAction(LogActions.UPDATE, {
      adminId,
      request,
      moduleName,
      targetId: id,
      valueBefore: existing,
      valueAfter: updated,
    });
    return updated;
  }

  async delete(
    id: string,
    adminId?: string,
    request?: any,
    moduleName?: string,
  ): Promise<void> {
    const existing = await this.globalConfigModel.findOne(id);
    if (!existing)
      throw new BadRequestException(
        ErrorMessageHelper.getMultiLanguageMessage('GLOBAL_CONFIG_NOT_FOUND'),
      );

    await this.prisma.globalConfig.delete({ where: { id } });

    if (CACHED_GLOBAL_CONFIG_KEYS.includes(existing.key)) {
      await this.redis.del(`global_config:${existing.key}`);
    }

    await this.helper.logAction(LogActions.DELETE, {
      adminId,
      request,
      moduleName,
      targetId: id,
      valueBefore: existing,
    });
  }
}
