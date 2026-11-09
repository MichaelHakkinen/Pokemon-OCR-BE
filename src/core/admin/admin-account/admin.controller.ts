import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  BadRequestException,
  HttpStatus,
  Query,
  UseGuards,
  Put,
  UseInterceptors,
  UploadedFile,
  Req,
  HttpCode,
} from '@nestjs/common';
import { AdminAuthGuard } from 'src/guards/AdminAuth.guard';
import { PermissionsGuard } from 'src/guards/Permission.guard';
import {
  RequireModule,
  RequireRule,
} from 'src/common/decorators/permission.decorator';
import { HelperService } from 'src/utils/helper.service';
import { AdminService } from './admin.service';
import * as bcrypt from 'bcrypt';
import { CreateAdminDto, UpdateAdminDto } from './dto/admin.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  defaultMaxFileSize,
  defaultAllowedImageTypeRegex,
  invalidMimesType,
  defaultAllowedImageTypes,
} from 'src/common/config/image.config';
import { ErrorMessageHelper } from 'src/common/helpers/error-message.helper';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import {
  ApiCommonErrorResponses,
  ApiSuccessNoDataResponse,
  ApiSuccessPaginationResponse,
  ApiSuccessResponse,
} from 'src/common/swagger/response.schemas';
import { AdminEntity } from './entities/admin.entity';
import { ResponseMessage } from 'src/common/decorators/response-message.decorator';
import { Paginated } from 'src/common/http/paginated';
import { UuidPipe } from 'src/pipes/uuid.pipe';
import { toDatatable } from 'src/common/http/datatable';

// Columns this list may be sorted by (anything else falls back to the default)
const ADMIN_SORTABLE = [
  'fullname',
  'username',
  'email',
  'phoneNumber',
  'isActive',
  'createdAt',
  'updatedAt',
];

@ApiTags('Admin Account')
@ApiBearerAuth()
@Controller('admin-account')
@UseGuards(AdminAuthGuard, PermissionsGuard)
@RequireModule('Admin Management')
export class AdminController {
  private readonly moduleName: string = 'Admin Management';

  constructor(
    private readonly adminService: AdminService,
    private readonly helper: HelperService,
  ) {}

  @Get()
  @RequireRule('View List')
  @ApiOperation({
    summary: 'List',
    description:
      "Retrieve a paginated list of admin accounts. Requires the 'View List' permission rule in the Admin Management module.",
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number to retrieve',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of records per page',
    example: 10,
  })
  @ApiQuery({
    name: 'sort',
    required: false,
    description: 'Column name to sort by',
    example: 'createdAt',
  })
  @ApiQuery({
    name: 'sortDirection',
    required: false,
    description: "Sort direction, either 'asc' or 'desc'",
    example: 'desc',
  })
  @ApiQuery({
    name: 'q',
    required: false,
    description:
      'Search keyword, matched against fullname, email, username, and phoneNumber',
    example: 'farhan',
  })
  @ApiSuccessPaginationResponse(AdminEntity, {
    description: 'Admin accounts retrieved successfully',
  })
  @ApiCommonErrorResponses()
  @ResponseMessage('DATA_RETRIEVED_SUCCESS')
  async findAll(
    @Req() req,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
    @Query('sort') sort: string = 'createdAt',
    @Query('sortDirection') sortDirection: string = 'desc',
    @Query('q') q: string = null,
  ) {
    // Bad paging/sort values are fixed up, never passed to Prisma
    const data = await this.adminService.findAll(
      toDatatable(
        { page, limit, sort, sortDirection, q },
        { sortable: ADMIN_SORTABLE },
      ),
    );

    const pagination = {
      totalCount: data.pagination.totalCount,
      currentPage: data.pagination.currentPage,
      lowestNumber: data.data.length > 0 ? data.pagination.lowestNumber : 0,
      highestNumber: data.pagination.highestNumber,
    };

    return new Paginated(pagination, data.data);
  }

  @Get(':id')
  @RequireRule('View Details')
  @ApiOperation({
    summary: 'Detail',
    description:
      "Retrieve the details of a single admin account by ID. Requires the 'View Details' permission rule in the Admin Management module.",
  })
  @ApiParam({
    name: 'id',
    description: 'Admin account ID',
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
  })
  @ApiSuccessResponse(AdminEntity, {
    description: 'Admin account retrieved successfully',
  })
  @ApiCommonErrorResponses()
  @ResponseMessage('DATA_RETRIEVED_SUCCESS')
  async findOne(@Req() req, @Param('id', UuidPipe) id: string) {
    const data = await this.adminService.findOne(
      id,
      req.user?.id,
      req,
      this.moduleName,
    );

    return data;
  }

  @Post()
  @RequireRule('Add New')
  @ApiOperation({
    summary: 'Create',
    description:
      "Create a new admin account with an optional avatar image, and assign it to an admin group. Requires the 'Add New' permission rule in the Admin Management module.",
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        fullname: {
          type: 'string',
          example: 'Farhan Taufik Hidayat',
        },
        email: {
          type: 'string',
          example: 'farhan@team.superfk.co',
        },
        username: {
          type: 'string',
          example: 'farhanth',
        },
        phoneNumber: {
          type: 'string',
          example: '+6281231412322',
        },
        password: {
          type: 'string',
          example: 'Admin123!',
        },
        adminGroupId: {
          type: 'string',
          example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
        },
        isActive: {
          type: 'boolean',
          example: true,
        },
        avatar: {
          type: 'string',
          format: 'binary',
          description: 'optional | jpg / jpeg / png / webp | max 5MB',
        },
      },
      required: [
        'fullname',
        'username',
        'phoneNumber',
        'password',
        'adminGroupId',
      ],
    },
  })
  @ApiSuccessResponse(AdminEntity, {
    description: 'Admin account created successfully',
    status: HttpStatus.CREATED,
  })
  @ApiCommonErrorResponses({ includeValidation: true })
  @UseInterceptors(
    FileInterceptor('avatar', {
      limits: { fileSize: defaultMaxFileSize },
      fileFilter: (req, file, cb) => {
        if (file.mimetype.match(defaultAllowedImageTypeRegex)) {
          cb(null, true);
        } else {
          cb(invalidMimesType(defaultAllowedImageTypes, ['avatar']), false);
        }
      },
    }),
  )
  @ResponseMessage('DATA_CREATED_SUCCESS')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Req() req,
    @Body() createAdminDto: CreateAdminDto,
    @UploadedFile() avatar?: Express.Multer.File,
  ) {
    // lowercase CreateAdminDto.username
    createAdminDto.username = createAdminDto.username.toLowerCase();

    // check if email is already registered
    const admin = await this.adminService.checkUsernameExist(
      createAdminDto.username,
    );
    if (admin) {
      throw new BadRequestException(
        ErrorMessageHelper.getMultiLanguageMessage('USERNAME_EXISTS'),
      );
    }

    // check password criteria
    const password = await this.helper.validatePassword(
      createAdminDto.password,
    );
    if (!password) {
      throw new BadRequestException(
        ErrorMessageHelper.getMultiLanguageMessage('PASSWORD_CRITERIA_NOT_MET'),
      );
    }

    // generate the password hash
    const hashPassword = await bcrypt.hash(createAdminDto.password, 10);
    createAdminDto.password = hashPassword;

    // create admin with avatar file
    const data = await this.adminService.create(
      createAdminDto,
      avatar,
      req.user?.id,
      req,
      this.moduleName,
    );

    return data;
  }

  @Put(':id')
  @RequireRule('Edit')
  @ApiOperation({
    summary: 'Update',
    description:
      "Update an existing admin account, optionally replacing its avatar image and/or moving it to another admin group. Requires the 'Edit' permission rule in the Admin Management module.",
  })
  @ApiParam({
    name: 'id',
    description: 'Admin account ID',
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        fullname: {
          type: 'string',
          example: 'Farhan Taufik Hidayat',
        },
        email: {
          type: 'string',
          example: 'farhan@team.superfk.co',
        },
        phoneNumber: {
          type: 'string',
          example: '+6281231412322',
        },
        password: {
          type: 'string',
          description: 'optional | leave empty to keep the current password',
          example: 'Admin123!',
        },
        adminGroupId: {
          type: 'string',
          description: 'optional | leave empty to keep the current group',
          example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
        },
        isActive: {
          type: 'boolean',
          example: true,
        },
        avatar: {
          type: 'string',
          format: 'binary',
          description: 'optional | jpg / jpeg / png / webp | max 5MB',
        },
      },
      required: ['fullname', 'phoneNumber'],
    },
  })
  @ApiSuccessResponse(AdminEntity, {
    description: 'Admin account updated successfully',
  })
  @ApiCommonErrorResponses({ includeValidation: true })
  @UseInterceptors(
    FileInterceptor('avatar', {
      limits: { fileSize: defaultMaxFileSize },
      fileFilter: (req, file, cb) => {
        if (file.mimetype.match(defaultAllowedImageTypeRegex)) {
          cb(null, true);
        } else {
          cb(invalidMimesType(defaultAllowedImageTypes, ['avatar']), false);
        }
      },
    }),
  )
  @ResponseMessage('DATA_UPDATED_SUCCESS')
  async update(
    @Req() req,
    @Param('id', UuidPipe) id: string,
    @Body() updateAdminDto: UpdateAdminDto,
    @UploadedFile() avatar?: Express.Multer.File,
  ) {
    // check password criteria
    if (updateAdminDto.password) {
      const password = await this.helper.validatePassword(
        updateAdminDto.password,
      );
      if (!password) {
        throw new BadRequestException(
          ErrorMessageHelper.getMultiLanguageMessage(
            'PASSWORD_CRITERIA_NOT_MET',
          ),
        );
      }

      // generate the password hash
      const hashPassword = await bcrypt.hash(updateAdminDto.password, 10);
      updateAdminDto.password = hashPassword;
    }

    // update admin with avatar file
    const data = await this.adminService.update(
      id,
      updateAdminDto,
      avatar,
      req.user?.id,
      req,
      this.moduleName,
    );

    return data;
  }

  @Delete(':id')
  @RequireRule('Delete')
  @ApiOperation({
    summary: 'Delete',
    description:
      "Soft-delete an admin account. Requires the 'Delete' permission rule in the Admin Management module.",
  })
  @ApiParam({
    name: 'id',
    description: 'Admin account ID',
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
  })
  @ApiSuccessNoDataResponse({
    description: 'Admin account deleted successfully',
  })
  @ApiCommonErrorResponses()
  @ResponseMessage('DATA_DELETED_SUCCESS')
  async delete(@Req() req, @Param('id', UuidPipe) id: string) {
    await this.adminService.delete(id, req.user?.id, req, this.moduleName);

    return null;
  }

  @Put(':id/restore')
  @RequireRule('Restore')
  @ApiOperation({
    summary: 'Restore',
    description:
      "Restore a soft-deleted admin account. Requires the 'Restore' permission rule in the Admin Management module.",
  })
  @ApiParam({
    name: 'id',
    description: 'Admin account ID',
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
  })
  @ApiSuccessResponse(AdminEntity, {
    description: 'Admin account restored successfully',
  })
  @ApiCommonErrorResponses()
  @ResponseMessage('DATA_RESTORED_SUCCESS')
  async restore(@Req() req, @Param('id', UuidPipe) id: string) {
    const data = await this.adminService.restore(
      id,
      req.user?.id,
      req,
      this.moduleName,
    );

    return data;
  }
}
