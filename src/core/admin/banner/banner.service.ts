import { BadRequestException, Injectable } from '@nestjs/common';
import { ErrorMessageHelper } from 'src/common/helpers/error-message.helper';
import { QueryType } from 'src/models/admin/Banner.model';
import { HelperService } from 'src/utils/helper.service';
import { StorageService } from 'src/common/services/storage.service';
import { CreateBannerDto, UpdateBannerDto } from './dto/banner.dto';
import { BannerSortingDto } from './dto/sorting.dto';
import { ImportBannerDto } from './dto/import-banner.dto';
import { LogActions } from 'src/common/constants/log-actions';
import * as ExcelJS from 'exceljs';
import { randomBytes } from 'crypto';
import { PrismaService } from 'src/prisma/prisma.service';
import { BannerModel } from 'src/models';
import {
  parseBooleanCell,
  pickColumn,
  readSpreadsheet,
  SheetRow,
} from 'src/common/helpers/spreadsheet.helper';
import { TranslatedValidationPipe } from 'src/pipes/translated-validation.pipe';
import { lockScope, orderingScope } from 'src/common/helpers/db-lock.helper';

// Upper bound for one import file (rows below the header).
export const MAX_IMPORT_ROWS = 5000;

// Same validation (and translated messages) as request bodies.
const IMPORT_ROW_PIPE = new TranslatedValidationPipe({
  whitelist: true,
  transform: true,
  forbidNonWhitelisted: false,
});

export type ExportFile = {
  fileName: string;
  contentType: string;
  content: Buffer;
};

// Unique per request (time + random), so parallel exports never share a name.
const exportFileName = (ext: 'csv' | 'xlsx') =>
  `banners-${new Date().toISOString().replace(/[:.]/g, '-')}-${randomBytes(3).toString('hex')}.${ext}`;

// CSV cell: quote when needed, and prefix values a spreadsheet would run as
// a formula (=, +, -, @, tab, CR) with an apostrophe so they stay text.
export function escapeCsvField(field: unknown): string {
  if (field === null || field === undefined) return '';
  let str = String(field);
  if (/^[=+\-@\t\r]/.test(str)) str = `'${str}`;
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

@Injectable()
export class BannerService {
  constructor(
    private readonly helper: HelperService,
    private readonly storageService: StorageService,
    private readonly prisma: PrismaService,
    private readonly bannerModel: BannerModel,
  ) {}

  async findAll(query: QueryType): Promise<any> {
    // query data
    const banners = await this.bannerModel.findAll(query);

    // normalize data
    const data = banners.map((banner) => ({
      ...banner,
      mediaUrl: banner.mediaUrl
        ? this.helper.generateFileUrl(banner.mediaUrl)
        : null,
    }));

    return data;
  }

  async findOne(
    id: string,
    adminId?: string,
    request?: any,
    moduleName?: string,
  ): Promise<any> {
    if (!id) {
      throw new BadRequestException(
        ErrorMessageHelper.getMultiLanguageMessage('BANNER_NOT_FOUND'),
      );
    }

    // get data
    const banner = await this.bannerModel.findOneIgnoreStatus(id);
    if (!banner) {
      throw new BadRequestException(
        ErrorMessageHelper.getMultiLanguageMessage('BANNER_NOT_FOUND'),
      );
    }

    // normalize data
    const data = {
      ...banner,
      mediaUrl: banner.mediaUrl
        ? this.helper.generateFileUrl(banner.mediaUrl)
        : null,
    };

    // Log View action
    await this.helper.logAction(LogActions.VIEW, {
      adminId,
      request,
      moduleName,
      targetId: id,
      notes: 'View Banner Detail',
    });

    return data;
  }

  async create(
    createBannerDto: CreateBannerDto,
    mediaFile?: Express.Multer.File,
    adminId?: string,
    request?: any,
    moduleName?: string,
  ): Promise<any> {
    let uploadedMediaUrl: string = null;

    try {
      // Upload file if provided
      if (mediaFile) {
        uploadedMediaUrl = await this.storageService.uploadFile(mediaFile, {
          folder: 'banner',
          accept: ['image', 'video'], // banners may be images or videos
          identifier: createBannerDto.title || 'banner',
        });
      }

      const transaction = await this.prisma.$transaction(async (tx) => {
        // Next ordinal, read under the ordering lock so concurrent creates
        // can't get the same value
        await lockScope(tx, orderingScope('banner'));
        const latest = await tx.banner.aggregate({
          where: { deletedAt: null },
          _max: { ordinal: true },
        });
        const newOrdinal = (latest._max.ordinal ?? 0) + 1;

        // create banner
        const banner = await tx.banner.create({
          data: {
            title: createBannerDto.title,
            subtitle: createBannerDto.subtitle,
            mediaUrl: uploadedMediaUrl,
            urlTarget: createBannerDto.urlTarget,
            isActive: createBannerDto.isActive ?? true,
            ordinal: newOrdinal,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });

        // normalize data
        const data = {
          ...banner,
          mediaUrl: banner.mediaUrl
            ? this.helper.generateFileUrl(banner.mediaUrl)
            : null,
        };

        return data;
      });

      // Log creation action
      await this.helper.logAction(LogActions.ADD_NEW, {
        adminId,
        request,
        moduleName,
        targetId: transaction.id,
        notes: 'Add New Banner',
        valueAfter: transaction,
      });

      return transaction;
    } catch (error) {
      // If upload succeeded but database operation failed, delete the uploaded file
      if (uploadedMediaUrl) {
        await this.storageService.deleteFile(uploadedMediaUrl);
      }
      throw error;
    }
  }

  async update(
    id: string,
    updateBannerDto: UpdateBannerDto,
    mediaFile?: Express.Multer.File,
    adminId?: string,
    request?: any,
    moduleName?: string,
  ): Promise<any> {
    if (!id) {
      throw new BadRequestException(
        ErrorMessageHelper.getMultiLanguageMessage('BANNER_NOT_FOUND'),
      );
    }

    // check if banner exists
    const existingBanner = await this.bannerModel.findOneIgnoreStatus(id);
    if (!existingBanner) {
      throw new BadRequestException(
        ErrorMessageHelper.getMultiLanguageMessage('BANNER_NOT_FOUND'),
      );
    }

    let uploadedMediaUrl: string = null;
    const oldMediaUrl = existingBanner.mediaUrl;

    try {
      // Upload new file if provided
      if (mediaFile) {
        uploadedMediaUrl = await this.storageService.uploadFile(mediaFile, {
          folder: 'banner',
          accept: ['image', 'video'], // banners may be images or videos
          identifier: updateBannerDto.title || existingBanner.title || 'banner',
        });
      }

      const transaction = await this.prisma.$transaction(async (tx) => {
        // Update banner
        const banner = await tx.banner.update({
          where: { id },
          data: {
            title: updateBannerDto.title,
            subtitle: updateBannerDto.subtitle,
            mediaUrl: uploadedMediaUrl || existingBanner.mediaUrl,
            urlTarget: updateBannerDto.urlTarget,
            isActive: updateBannerDto.isActive ?? existingBanner.isActive,
            updatedAt: new Date(),
          },
        });

        // normalize data
        const data = {
          ...banner,
          mediaUrl: banner.mediaUrl
            ? this.helper.generateFileUrl(banner.mediaUrl)
            : null,
        };

        return data;
      });

      // Only after the update committed: remove the replaced file, unless
      // another banner still points at it (imports can share a mediaUrl).
      if (uploadedMediaUrl && oldMediaUrl && oldMediaUrl !== uploadedMediaUrl) {
        const stillUsed = await this.prisma.banner.count({
          where: { mediaUrl: oldMediaUrl },
        });
        if (stillUsed === 0) await this.storageService.deleteFile(oldMediaUrl);
      }

      // Log update action
      await this.helper.logAction(LogActions.UPDATE, {
        adminId,
        request,
        moduleName,
        targetId: transaction.id,
        notes: 'Update Banner',
        valueBefore: existingBanner,
        valueAfter: transaction,
      });

      return transaction;
    } catch (error) {
      // If upload succeeded but database operation failed, delete the newly uploaded file
      if (uploadedMediaUrl) {
        await this.storageService.deleteFile(uploadedMediaUrl);
      }
      throw error;
    }
  }

  async delete(
    id: string,
    adminId?: string,
    request?: any,
    moduleName?: string,
  ): Promise<void> {
    if (!id) {
      throw new BadRequestException(
        ErrorMessageHelper.getMultiLanguageMessage('BANNER_NOT_FOUND'),
      );
    }

    // check if banner exists
    const banner = await this.bannerModel.findOneIgnoreStatus(id);
    if (!banner) {
      throw new BadRequestException(
        ErrorMessageHelper.getMultiLanguageMessage('BANNER_NOT_FOUND'),
      );
    }

    await this.prisma.$transaction(async (tx) => {
      // Soft delete the banner (file is kept for restore functionality)
      await tx.banner.update({
        where: { id },
        data: {
          deletedAt: new Date(),
        },
      });
    });

    // Log delete action
    await this.helper.logAction(LogActions.DELETE, {
      adminId,
      request,
      moduleName,
      targetId: id,
      notes: 'Delete Banner',
      valueBefore: banner,
    });
  }

  async sorting(bannerSortingDto: BannerSortingDto): Promise<any> {
    const transaction = await this.prisma.$transaction(async (tx) => {
      await lockScope(tx, orderingScope('banner'));

      // Live banners in list order (position 1 = lowest ordinal, as listed);
      // soft-deleted banners neither count nor can be moved.
      const allBanners = await tx.banner.findMany({
        where: { deletedAt: null },
        orderBy: {
          ordinal: 'asc',
        },
      });

      // Check if the banner to move exists
      const bannerToMove = allBanners.find(
        (banner) => banner.id === bannerSortingDto.id,
      );

      if (!bannerToMove) {
        throw new BadRequestException(
          ErrorMessageHelper.getMultiLanguageMessage('BANNER_NOT_FOUND'),
        );
      }

      // Validate new position
      if (bannerSortingDto.newPosition > allBanners.length) {
        throw new BadRequestException(
          ErrorMessageHelper.getMultiLanguageMessageWithReplace(
            'INVALID_BANNER_POSITION',
            {
              maxPosition: allBanners.length.toString(),
            },
          ),
        );
      }

      // Find current position (1-based index)
      const currentPosition =
        allBanners.findIndex((banner) => banner.id === bannerSortingDto.id) + 1;

      // If position hasn't changed, no need to update
      if (currentPosition === bannerSortingDto.newPosition) {
        const normalizedData = {
          ...bannerToMove,
          mediaUrl: bannerToMove.mediaUrl
            ? this.helper.generateFileUrl(bannerToMove.mediaUrl)
            : null,
        };
        return normalizedData;
      }

      // Remove banner from current position
      const bannersArray = [...allBanners];
      const [movedBanner] = bannersArray.splice(currentPosition - 1, 1);

      // Insert banner at new position
      bannersArray.splice(bannerSortingDto.newPosition - 1, 0, movedBanner);

      // Recalculate ordinals so ordinal = position (1, 2, 3, ...)
      const updatePromises = [];
      for (let i = 0; i < bannersArray.length; i++) {
        const newOrdinal = i + 1;

        // Only update if ordinal has changed
        if (bannersArray[i].ordinal !== newOrdinal) {
          updatePromises.push(
            tx.banner.update({
              where: { id: bannersArray[i].id },
              data: { ordinal: newOrdinal, updatedAt: new Date() },
            }),
          );
        }
      }

      // Execute all updates in parallel
      const updates = await Promise.all(updatePromises);

      // Normalize all updated banners data with full media URL
      const normalizedUpdates = updates.map((banner) => ({
        ...banner,
        mediaUrl: banner.mediaUrl
          ? this.helper.generateFileUrl(banner.mediaUrl)
          : null,
      }));

      return normalizedUpdates;
    });

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
        ErrorMessageHelper.getMultiLanguageMessage('BANNER_NOT_FOUND'),
      );
    }

    // check if data exists and is deleted
    const banner = await this.prisma.banner.findFirst({
      where: {
        id,
      },
    });

    if (!banner) {
      throw new BadRequestException(
        ErrorMessageHelper.getMultiLanguageMessage('BANNER_NOT_FOUND'),
      );
    }

    if (banner.deletedAt === null) {
      throw new BadRequestException(
        ErrorMessageHelper.getMultiLanguageMessage('BANNER_NOT_DELETED'),
      );
    }

    const transaction = await this.prisma.$transaction(async (tx) => {
      // restore data by setting deletedAt to null
      // A restored banner goes to the end of the live list (its old ordinal
      // may have been reused while it was deleted).
      await lockScope(tx, orderingScope('banner'));
      const last = await tx.banner.aggregate({
        where: { deletedAt: null },
        _max: { ordinal: true },
      });
      const restoredBanner = await tx.banner.update({
        where: { id },
        data: {
          deletedAt: null,
          ordinal: (last._max.ordinal ?? 0) + 1,
          updatedAt: new Date(),
        },
      });

      // normalize data
      const data = {
        ...restoredBanner,
        mediaUrl: restoredBanner.mediaUrl
          ? this.helper.generateFileUrl(restoredBanner.mediaUrl)
          : null,
      };

      return data;
    });

    // Log restore action
    await this.helper.logAction(LogActions.RESTORE, {
      adminId,
      request,
      moduleName,
      targetId: id,
      notes: 'Restore Banner',
    });

    return transaction;
  }

  async importBanners(
    file: Express.Multer.File,
    fileType: 'xlsx' | 'csv',
  ): Promise<any> {
    // Parsed straight from the upload buffer — the spreadsheet itself is not
    // stored. Cells arrive as plain text (hyperlinks, formulas, booleans
    // unwrapped), at most MAX_IMPORT_ROWS rows.
    const rows = await readSpreadsheet(file.buffer, fileType, {
      maxRows: MAX_IMPORT_ROWS,
    });
    if (rows.length === 0) {
      throw new BadRequestException(
        ErrorMessageHelper.getMultiLanguageMessage('NO_DATA_FOUND'),
      );
    }

    // Validate every row first (same DTO rules and translated messages as
    // the API); nothing is written unless the whole file is valid.
    const validBanners: ImportBannerDto[] = [];
    const errors: { row: number; field: string; message: unknown }[] = [];
    for (let i = 0; i < rows.length; i++) {
      const rowNumber = i + 2; // row 1 is the header
      const { banner, errors: rowErrors } = await this.toImportBanner(rows[i]);
      if (rowErrors.length > 0) {
        errors.push(...rowErrors.map((e) => ({ row: rowNumber, ...e })));
      } else {
        validBanners.push(banner);
      }
    }

    if (errors.length > 0) {
      throw new BadRequestException({
        message: ErrorMessageHelper.getMultiLanguageMessage(
          'VALIDATION_ERRORS_FOUND',
        ),
        totalRows: rows.length,
        totalErrors: errors.length,
        errors,
      });
    }

    // All or nothing: one transaction, one bulk insert.
    const created = await this.prisma.$transaction(
      async (tx) => {
        await lockScope(tx, orderingScope('banner'));
        const latest = await tx.banner.aggregate({
          where: { deletedAt: null },
          _max: { ordinal: true },
        });
        let ordinal = latest._max.ordinal ?? 0;
        const now = new Date();
        return tx.banner.createManyAndReturn({
          data: validBanners.map((banner) => ({
            title: banner.title ?? null,
            subtitle: banner.subtitle ?? null,
            mediaUrl: banner.mediaUrl,
            urlTarget: banner.urlTarget ?? null,
            isActive: banner.isActive ?? true,
            ordinal: ++ordinal,
            createdAt: now,
            updatedAt: now,
          })),
        });
      },
      { timeout: 30_000 },
    );

    return {
      totalProcessed: rows.length,
      totalImported: created.length,
      data: created.map((banner) => ({
        id: banner.id,
        title: banner.title,
        subtitle: banner.subtitle,
        mediaUrl: banner.mediaUrl
          ? this.helper.generateFileUrl(banner.mediaUrl)
          : null,
        urlTarget: banner.urlTarget,
        ordinal: banner.ordinal,
        isActive: banner.isActive,
      })),
    };
  }

  // Maps one spreadsheet row (header aliases kept for existing templates) to
  // an ImportBannerDto and validates it like a request body.
  private async toImportBanner(row: SheetRow): Promise<{
    banner?: ImportBannerDto;
    errors: { field: string; message: unknown }[];
  }> {
    const isActiveText = pickColumn(row, [
      'isactive',
      'is active',
      'active',
      'status',
    ]);
    const isActive = parseBooleanCell(isActiveText, true);
    if (isActive === undefined) {
      return {
        errors: [
          {
            field: 'isActive',
            message: ErrorMessageHelper.getMultiLanguageMessageWithReplace(
              'IMPORT_INVALID_BOOLEAN',
              { field: 'isActive' },
            ),
          },
        ],
      };
    }

    const optional = (value: string) => (value === '' ? undefined : value);
    const plain = {
      title: optional(pickColumn(row, ['title', 'banner title'])),
      subtitle: optional(pickColumn(row, ['subtitle', 'banner subtitle'])),
      mediaUrl: pickColumn(row, [
        'mediaurl',
        'media url',
        'image',
        'image url',
      ]),
      urlTarget: optional(
        pickColumn(row, ['urltarget', 'url target', 'link', 'url']),
      ),
      isActive,
    };

    try {
      const banner = await IMPORT_ROW_PIPE.transform(plain, {
        type: 'body',
        metatype: ImportBannerDto,
      });
      return { banner, errors: [] };
    } catch (error) {
      const fields = (error?.getResponse?.() as any)?.errors ?? {};
      return {
        errors: Object.entries(fields).map(([field, message]) => ({
          field,
          message,
        })),
      };
    }
  }

  async exportToCSV(
    search: string = null,
    status: boolean | undefined = undefined,
  ): Promise<ExportFile> {
    const CHUNK_SIZE = 1000; // Process 1000 records at a time

    // Parsed by the controller (queryFlag): true / false / undefined = all
    const statusFilter = status;

    // Build where conditions
    const whereConditions: any = {
      deletedAt: null,
    };

    if (statusFilter !== undefined) {
      whereConditions.isActive = statusFilter;
    }

    if (search) {
      whereConditions.OR = [
        {
          title: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          subtitle: {
            contains: search,
            mode: 'insensitive',
          },
        },
      ];
    }

    // Get total count
    const totalCount = await this.prisma.banner.count({
      where: whereConditions,
    });

    // Built in memory and sent directly: no shared temp file that two
    // concurrent exports (or an aborted download) could collide on.
    const lines = [
      'ID,Title,Subtitle,Media URL,URL Target,Status,Order,Created At,Updated At',
    ];

    // Process data in chunks
    for (let skip = 0; skip < totalCount; skip += CHUNK_SIZE) {
      const banners = await this.prisma.banner.findMany({
        where: whereConditions,
        orderBy: {
          ordinal: 'asc', // same order as the list
        },
        skip,
        take: CHUNK_SIZE,
      });

      // Transform data to CSV rows
      lines.push(
        ...banners.map((banner) =>
          [
            escapeCsvField(banner.id),
            escapeCsvField(banner.title),
            escapeCsvField(banner.subtitle),
            escapeCsvField(banner.mediaUrl),
            escapeCsvField(banner.urlTarget),
            escapeCsvField(banner.isActive ? 'Active' : 'Inactive'),
            escapeCsvField(banner.ordinal || 0),
            escapeCsvField(
              banner.createdAt ? new Date(banner.createdAt).toISOString() : '',
            ),
            escapeCsvField(
              banner.updatedAt ? new Date(banner.updatedAt).toISOString() : '',
            ),
          ].join(','),
        ),
      );
    }

    return {
      fileName: exportFileName('csv'),
      contentType: 'text/csv; charset=utf-8',
      content: Buffer.from(lines.join('\n') + '\n', 'utf8'),
    };
  }

  async exportToXLSX(
    search: string = null,
    status: boolean | undefined = undefined,
  ): Promise<ExportFile> {
    const CHUNK_SIZE = 1000; // Process 1000 records at a time

    // Parsed by the controller (queryFlag): true / false / undefined = all
    const statusFilter = status;

    // Build where conditions
    const whereConditions: any = {
      deletedAt: null,
    };

    if (statusFilter !== undefined) {
      whereConditions.isActive = statusFilter;
    }

    if (search) {
      whereConditions.OR = [
        {
          title: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          subtitle: {
            contains: search,
            mode: 'insensitive',
          },
        },
      ];
    }

    // Get total count
    const totalCount = await this.prisma.banner.count({
      where: whereConditions,
    });

    // Create workbook and worksheet (in memory, sent directly)
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Banners');

    // Define columns
    worksheet.columns = [
      { header: 'ID', key: 'id', width: 40 },
      { header: 'Title', key: 'title', width: 30 },
      { header: 'Subtitle', key: 'subtitle', width: 40 },
      { header: 'Media URL', key: 'mediaUrl', width: 50 },
      { header: 'URL Target', key: 'urlTarget', width: 50 },
      { header: 'Status', key: 'isActive', width: 15 },
      { header: 'Order', key: 'ordinal', width: 10 },
      { header: 'Created At', key: 'createdAt', width: 20 },
      { header: 'Updated At', key: 'updatedAt', width: 20 },
    ];

    // Style the header row
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };

    // Process data in chunks to avoid memory issues
    for (let skip = 0; skip < totalCount; skip += CHUNK_SIZE) {
      const banners = await this.prisma.banner.findMany({
        where: whereConditions,
        orderBy: {
          ordinal: 'asc', // same order as the list
        },
        skip,
        take: CHUNK_SIZE,
      });

      // Add rows to worksheet
      banners.forEach((banner) => {
        worksheet.addRow({
          id: banner.id,
          title: banner.title || '',
          subtitle: banner.subtitle || '',
          mediaUrl: banner.mediaUrl || '',
          urlTarget: banner.urlTarget || '',
          isActive: banner.isActive ? 'Active' : 'Inactive',
          ordinal: banner.ordinal || 0,
          createdAt: banner.createdAt
            ? new Date(banner.createdAt).toISOString()
            : '',
          updatedAt: banner.updatedAt
            ? new Date(banner.updatedAt).toISOString()
            : '',
        });
      });
    }

    return {
      fileName: exportFileName('xlsx'),
      contentType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      content: Buffer.from(await workbook.xlsx.writeBuffer()),
    };
  }
}
