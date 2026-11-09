import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Res,
  HttpStatus,
  Query,
  UseGuards,
  Put,
  UseInterceptors,
  UploadedFile,
  Req,
  BadRequestException,
  HttpCode,
} from '@nestjs/common';
import { Response } from 'express';
import { AdminAuthGuard } from 'src/guards/AdminAuth.guard';
import { PermissionsGuard } from 'src/guards/Permission.guard';
import {
  RequireModule,
  RequireRule,
} from 'src/common/decorators/permission.decorator';
import { HelperService } from 'src/utils/helper.service';
import { NoFilesInterceptor, FileInterceptor } from '@nestjs/platform-express';
import {
  defaultMaxVideoFileSize,
  defaultAllowedMediaTypeRegex,
  invalidMimesType,
  defaultAllowedMediaTypes,
} from 'src/common/config/image.config';
import { ErrorMessageHelper } from 'src/common/helpers/error-message.helper';
import { BannerService } from './banner.service';
import { CreateBannerDto, UpdateBannerDto } from './dto/banner.dto';
import { BannerSortingDto } from './dto/sorting.dto';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  ApiCommonErrorResponses,
  ApiSuccessNoDataResponse,
  ApiSuccessResponse,
} from 'src/common/swagger/response.schemas';
import {
  BannerEntity,
  BannerImportResultEntity,
} from './entities/banner.entity';
import { ResponseMessage } from 'src/common/decorators/response-message.decorator';
import { UuidPipe } from 'src/pipes/uuid.pipe';
import { queryFlag, queryString } from 'src/common/http/datatable';

@ApiTags('Banner')
@ApiBearerAuth()
@Controller('banner')
@UseGuards(AdminAuthGuard, PermissionsGuard)
@RequireModule('Banner Management')
export class BannerController {
  private readonly moduleName: string = 'Banner Management';

  constructor(
    private readonly bannerService: BannerService,
    private readonly helper: HelperService,
  ) {}

  @ApiOperation({
    summary: 'List',
    description:
      "Retrieves all banners ordered by their sort position. Requires the 'View List' permission rule on the Banner Management module.",
  })
  @ApiQuery({
    name: 'q',
    required: false,
    description: 'Search keyword, matched against banner title and subtitle',
    example: 'summer sale',
  })
  @ApiQuery({
    name: 'deletedItems',
    required: false,
    description:
      'Set to "true" to include soft-deleted banners in the result, defaults to "false"',
    example: 'false',
  })
  @ApiSuccessResponse(BannerEntity, {
    description: 'Banners retrieved successfully',
    isArray: true,
  })
  @ApiCommonErrorResponses()
  @Get()
  @RequireRule('View List')
  @ResponseMessage('DATA_RETRIEVED_SUCCESS')
  async findAll(
    @Req() req,
    @Query('q') q?: string,
    @Query('deletedItems') deletedItems?: string,
  ) {
    const data = await this.bannerService.findAll({
      search: queryString(q),
      deletedItems: queryFlag(deletedItems) ?? false,
    });

    return data;
  }

  @ApiOperation({
    summary: 'Sorting',
    description:
      "Moves a banner to a new 1-based sort position and recalculates ordinals for all banners. Requires the 'Sorting' permission rule on the Banner Management module.",
  })
  @ApiSuccessResponse(BannerEntity, {
    description: 'Banner sorting updated successfully',
    isArray: true,
  })
  @ApiCommonErrorResponses({ includeValidation: true })
  @Put('sorting')
  @RequireRule('Sorting')
  // multipart form fields accepted, files rejected (sorting takes no files;
  // the previous AnyFilesInterceptor buffered any number of them, unlimited)
  @UseInterceptors(NoFilesInterceptor())
  @ResponseMessage('SORTING_UPDATED_SUCCESS')
  async reorder(@Req() req, @Body() bannerSortingDto: BannerSortingDto) {
    const data = await this.bannerService.sorting(bannerSortingDto);

    return data;
  }

  @ApiOperation({
    summary: 'Detail',
    description:
      "Retrieves the details of a single banner (including soft-deleted ones). Requires the 'View Details' permission rule on the Banner Management module.",
  })
  @ApiParam({ name: 'id', description: 'Banner id (UUID)' })
  @ApiSuccessResponse(BannerEntity, {
    description: 'Banner retrieved successfully',
  })
  @ApiCommonErrorResponses()
  @Get(':id')
  @RequireRule('View Details')
  @ResponseMessage('DATA_RETRIEVED_SUCCESS')
  async findOne(@Req() req, @Param('id', UuidPipe) id: string) {
    const data = await this.bannerService.findOne(
      id,
      req.user?.id,
      req,
      this.moduleName,
    );

    return data;
  }

  @ApiOperation({
    summary: 'Create',
    description:
      "Creates a new banner, optionally with an uploaded image or video, appended to the end of the sort order. Requires the 'Add New' permission rule on the Banner Management module.",
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        title: { type: 'string', example: 'Summer Sale 2026' },
        subtitle: {
          type: 'string',
          example: 'Up to 50% off on selected items',
        },
        urlTarget: {
          type: 'string',
          example: 'https://example.com/promo/summer-sale',
        },
        isActive: { type: 'boolean', example: true },
        mediaUrl: {
          type: 'string',
          format: 'binary',
          description: 'optional | image or video | min: 2mb',
        },
      },
    },
  })
  @ApiSuccessResponse(BannerEntity, {
    description: 'Banner created successfully',
    status: HttpStatus.CREATED,
  })
  @ApiCommonErrorResponses({ includeValidation: true })
  @Post()
  @RequireRule('Add New')
  @UseInterceptors(
    FileInterceptor('mediaUrl', {
      limits: { fileSize: defaultMaxVideoFileSize },
      fileFilter: (req, file, cb) => {
        if (file.mimetype.match(defaultAllowedMediaTypeRegex)) {
          cb(null, true);
        } else {
          cb(invalidMimesType(defaultAllowedMediaTypes, ['mediaUrl']), false);
        }
      },
    }),
  )
  @ResponseMessage('DATA_CREATED_SUCCESS')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Req() req,
    @Body() createBannerDto: CreateBannerDto,
    @UploadedFile() mediaUrl?: Express.Multer.File,
  ) {
    // create banner
    const data = await this.bannerService.create(
      createBannerDto,
      mediaUrl,
      req.user?.id,
      req,
      this.moduleName,
    );

    return data;
  }

  @ApiOperation({
    summary: 'Update',
    description:
      "Updates an existing banner's fields, optionally replacing its media file (the old file is deleted after a successful upload). Requires the 'Edit' permission rule on the Banner Management module.",
  })
  @ApiParam({ name: 'id', description: 'Banner id (UUID)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        title: { type: 'string', example: 'Summer Sale 2026' },
        subtitle: {
          type: 'string',
          example: 'Up to 50% off on selected items',
        },
        urlTarget: {
          type: 'string',
          example: 'https://example.com/promo/summer-sale',
        },
        isActive: { type: 'boolean', example: true },
        mediaUrl: {
          type: 'string',
          format: 'binary',
          description: 'optional | image or video | min: 2mb',
        },
      },
    },
  })
  @ApiSuccessResponse(BannerEntity, {
    description: 'Banner updated successfully',
  })
  @ApiCommonErrorResponses({ includeValidation: true })
  @Put(':id')
  @RequireRule('Edit')
  @UseInterceptors(
    FileInterceptor('mediaUrl', {
      limits: { fileSize: defaultMaxVideoFileSize },
      fileFilter: (req, file, cb) => {
        if (file.mimetype.match(defaultAllowedMediaTypeRegex)) {
          cb(null, true);
        } else {
          cb(invalidMimesType(defaultAllowedMediaTypes, ['mediaUrl']), false);
        }
      },
    }),
  )
  @ResponseMessage('DATA_UPDATED_SUCCESS')
  async update(
    @Req() req,
    @Param('id', UuidPipe) id: string,
    @Body() updateBannerDto: UpdateBannerDto,
    @UploadedFile() mediaUrl?: Express.Multer.File,
  ) {
    // update banner
    const data = await this.bannerService.update(
      id,
      updateBannerDto,
      mediaUrl,
      req.user?.id,
      req,
      this.moduleName,
    );

    return data;
  }

  @ApiOperation({
    summary: 'Delete',
    description:
      "Soft-deletes a banner (the media file is kept for restore). Requires the 'Delete' permission rule on the Banner Management module.",
  })
  @ApiParam({ name: 'id', description: 'Banner id (UUID)' })
  @ApiSuccessNoDataResponse({ description: 'Banner deleted successfully' })
  @ApiCommonErrorResponses()
  @Delete(':id')
  @RequireRule('Delete')
  @ResponseMessage('DATA_DELETED_SUCCESS')
  async delete(@Req() req, @Param('id', UuidPipe) id: string) {
    await this.bannerService.delete(id, req.user?.id, req, this.moduleName);

    return null;
  }

  @ApiOperation({
    summary: 'Restore',
    description:
      "Restores a previously soft-deleted banner by clearing its deletedAt timestamp. Requires the 'Restore' permission rule on the Banner Management module.",
  })
  @ApiParam({ name: 'id', description: 'Banner id (UUID)' })
  @ApiSuccessResponse(BannerEntity, {
    description: 'Banner restored successfully',
  })
  @ApiCommonErrorResponses()
  @Put(':id/restore')
  @RequireRule('Restore')
  @ResponseMessage('DATA_RESTORED_SUCCESS')
  async restore(@Req() req, @Param('id', UuidPipe) id: string) {
    const data = await this.bannerService.restore(
      id,
      req.user?.id,
      req,
      this.moduleName,
    );

    return data;
  }

  @ApiOperation({
    summary: 'Import',
    description:
      "Parses an uploaded .xlsx/.xls/.csv file and creates a banner for each valid row (mediaUrl is required per row). Requires the 'Add New' permission rule on the Banner Management module.",
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Spreadsheet file (.xlsx, .xls, or .csv), max 10MB',
        },
      },
    },
  })
  @ApiSuccessResponse(BannerImportResultEntity, {
    description: 'Banners imported successfully',
    status: HttpStatus.CREATED,
  })
  @ApiCommonErrorResponses()
  @Post('import')
  @RequireRule('Add New')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
      fileFilter: (req, file, cb) => {
        const allowedMimeTypes = [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
          'application/vnd.ms-excel', // .xls
          'text/csv', // .csv
        ];

        if (allowedMimeTypes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(
            new BadRequestException(
              ErrorMessageHelper.getMultiLanguageMessage('INVALID_FILE_TYPE'),
            ),
            false,
          );
        }
      },
    }),
  )
  @ResponseMessage('DATA_CREATED_SUCCESS')
  @HttpCode(HttpStatus.CREATED)
  async importBanners(@Req() req, @UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException(
        ErrorMessageHelper.getMultiLanguageMessage('FILE_REQUIRED'),
      );
    }

    // Determine file type
    const fileExt = file.originalname.split('.').pop()?.toLowerCase();
    let fileType: 'xlsx' | 'csv';

    if (fileExt === 'xlsx' || fileExt === 'xls') {
      fileType = 'xlsx';
    } else if (fileExt === 'csv') {
      fileType = 'csv';
    } else {
      throw new BadRequestException(
        ErrorMessageHelper.getMultiLanguageMessage('INVALID_FILE_TYPE'),
      );
    }

    const data = await this.bannerService.importBanners(file, fileType);

    return data;
  }

  @ApiOperation({
    summary: 'Export CSV',
    description:
      "Streams all matching, non-deleted banners as a downloadable CSV file. Requires the 'View List' permission rule on the Banner Management module.",
  })
  @ApiQuery({
    name: 'q',
    required: false,
    description: 'Search keyword, matched against banner title and subtitle',
    example: 'summer sale',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    description:
      'Filter by active status: "true" for active, "false" for inactive. Omit to include both',
    example: 'true',
  })
  @ApiProduces('text/csv')
  @ApiResponse({ status: HttpStatus.OK, description: 'CSV file stream' })
  @Get('export/csv')
  @RequireRule('View List')
  async exportCSV(
    @Req() req,
    @Res() res: Response,
    @Query('q') q?: string,
    @Query('status') status?: string,
  ) {
    // Built in memory and sent in one go — no temp file to collide on or
    // leave behind when a download is aborted.
    const file = await this.bannerService.exportToCSV(
      queryString(q),
      queryFlag(status),
    );
    res.setHeader('Content-Type', file.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.fileName}"`,
    );
    res.send(file.content);
  }

  @ApiOperation({
    summary: 'Export XLSX',
    description:
      "Streams all matching, non-deleted banners as a downloadable XLSX file. Requires the 'View List' permission rule on the Banner Management module.",
  })
  @ApiQuery({
    name: 'q',
    required: false,
    description: 'Search keyword, matched against banner title and subtitle',
    example: 'summer sale',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    description:
      'Filter by active status: "true" for active, "false" for inactive. Omit to include both',
    example: 'true',
  })
  @ApiProduces(
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  @ApiResponse({ status: HttpStatus.OK, description: 'XLSX file stream' })
  @Get('export/xlsx')
  @RequireRule('View List')
  async exportXLSX(
    @Req() req,
    @Res() res: Response,
    @Query('q') q?: string,
    @Query('status') status?: string,
  ) {
    // Built in memory and sent in one go — no temp file to collide on or
    // leave behind when a download is aborted.
    const file = await this.bannerService.exportToXLSX(
      queryString(q),
      queryFlag(status),
    );
    res.setHeader('Content-Type', file.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.fileName}"`,
    );
    res.send(file.content);
  }
}
