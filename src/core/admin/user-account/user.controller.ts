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
import { UserService } from './user.service';
import * as bcrypt from 'bcrypt';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';
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
import { UserEntity } from './entities/user.entity';
import { ResponseMessage } from 'src/common/decorators/response-message.decorator';
import { Paginated } from 'src/common/http/paginated';
import { UuidPipe } from 'src/pipes/uuid.pipe';
import { toDatatable } from 'src/common/http/datatable';

const userWriteBodySchema = (isUpdate: boolean) => ({
  type: 'object' as const,
  properties: {
    fullname: { type: 'string', example: 'John Doe' },
    email: { type: 'string', example: 'johndoe@example.com' },
    phoneNumber: { type: 'string', example: '081234567890' },
    ...(isUpdate ? {} : { username: { type: 'string', example: 'johndoe' } }),
    password: {
      type: 'string',
      example: 'User1234!',
      description: isUpdate
        ? 'New password (minimum 8 characters). Leave empty to keep the current password'
        : 'Password (minimum 8 characters)',
    },
    isActive: { type: 'boolean', example: true },
    avatar: {
      type: 'string',
      format: 'binary',
      description: 'Optional avatar image file',
    },
  },
  required: isUpdate
    ? ['fullname', 'phoneNumber']
    : ['fullname', 'username', 'phoneNumber', 'password'],
});

// Columns this list may be sorted by (anything else falls back to the default)
const USER_SORTABLE = [
  'fullname',
  'username',
  'email',
  'phoneNumber',
  'isActive',
  'createdAt',
  'updatedAt',
];

@ApiTags('User Account')
@ApiBearerAuth()
@Controller('user-account')
@UseGuards(AdminAuthGuard, PermissionsGuard)
@RequireModule('User Management')
export class UserController {
  private readonly moduleName: string = 'User Management';

  constructor(
    private readonly userService: UserService,
    private readonly helper: HelperService,
  ) {}

  @ApiOperation({
    summary: 'List',
    description:
      "Requires the 'View List' permission rule for the User Management module.",
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
    description: 'Search keyword to filter results',
    example: 'john',
  })
  @ApiSuccessPaginationResponse(UserEntity, {
    description: 'List of user accounts retrieved successfully',
  })
  @ApiCommonErrorResponses()
  @Get()
  @RequireRule('View List')
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
    const data = await this.userService.findAll(
      toDatatable(
        { page, limit, sort, sortDirection, q },
        { sortable: USER_SORTABLE },
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

  @ApiOperation({
    summary: 'Detail',
    description:
      "Requires the 'View Details' permission rule for the User Management module.",
  })
  @ApiParam({ name: 'id', description: 'User account ID (UUID)' })
  @ApiSuccessResponse(UserEntity, {
    description: 'User account retrieved successfully',
  })
  @ApiCommonErrorResponses()
  @Get(':id')
  @RequireRule('View Details')
  @ResponseMessage('DATA_RETRIEVED_SUCCESS')
  async findOne(@Req() req, @Param('id', UuidPipe) id: string) {
    const data = await this.userService.findOne(
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
      "Requires the 'Add New' permission rule for the User Management module. Accepts an optional avatar image upload.",
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: userWriteBodySchema(false) })
  @ApiSuccessResponse(UserEntity, {
    description: 'User account created successfully',
    status: HttpStatus.CREATED,
  })
  @ApiCommonErrorResponses({ includeValidation: true })
  @Post()
  @RequireRule('Add New')
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
    @Body() createUserDto: CreateUserDto,
    @UploadedFile() avatar?: Express.Multer.File,
  ) {
    // lowercase CreateUserDto.username
    createUserDto.username = createUserDto.username.toLowerCase();

    // check if email is already registered
    const user = await this.userService.checkUsernameExist(
      createUserDto.username,
    );
    if (user) {
      throw new BadRequestException(
        ErrorMessageHelper.getMultiLanguageMessage('USERNAME_EXISTS'),
      );
    }

    // check password criteria
    const password = await this.helper.validatePassword(createUserDto.password);
    if (!password) {
      throw new BadRequestException(
        ErrorMessageHelper.getMultiLanguageMessage('PASSWORD_CRITERIA_NOT_MET'),
      );
    }

    // generate the password hash
    const hashPassword = await bcrypt.hash(createUserDto.password, 10);
    createUserDto.password = hashPassword;

    // create user with avatar file
    const data = await this.userService.create(
      createUserDto,
      avatar,
      req.user?.id,
      req,
      this.moduleName,
    );

    return data;
  }

  @ApiOperation({
    summary: 'Update',
    description:
      "Requires the 'Edit' permission rule for the User Management module. Accepts an optional avatar image upload; omit the password field to keep the current password.",
  })
  @ApiParam({ name: 'id', description: 'User account ID (UUID)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: userWriteBodySchema(true) })
  @ApiSuccessResponse(UserEntity, {
    description: 'User account updated successfully',
  })
  @ApiCommonErrorResponses({ includeValidation: true })
  @Put(':id')
  @RequireRule('Edit')
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
    @Body() updateUserDto: UpdateUserDto,
    @UploadedFile() avatar?: Express.Multer.File,
  ) {
    // check password criteria
    if (updateUserDto.password) {
      const password = await this.helper.validatePassword(
        updateUserDto.password,
      );
      if (!password) {
        throw new BadRequestException(
          ErrorMessageHelper.getMultiLanguageMessage(
            'PASSWORD_CRITERIA_NOT_MET',
          ),
        );
      }

      // generate the password hash
      const hashPassword = await bcrypt.hash(updateUserDto.password, 10);
      updateUserDto.password = hashPassword;
    }

    // update user with avatar file
    const data = await this.userService.update(
      id,
      updateUserDto,
      avatar,
      req.user?.id,
      req,
      this.moduleName,
    );

    return data;
  }

  @ApiOperation({
    summary: 'Delete',
    description:
      "Requires the 'Delete' permission rule for the User Management module.",
  })
  @ApiParam({ name: 'id', description: 'User account ID (UUID)' })
  @ApiSuccessNoDataResponse({
    description: 'User account deleted successfully',
  })
  @ApiCommonErrorResponses()
  @Delete(':id')
  @RequireRule('Delete')
  @ResponseMessage('DATA_DELETED_SUCCESS')
  async delete(@Req() req, @Param('id', UuidPipe) id: string) {
    await this.userService.delete(id, req.user?.id, req, this.moduleName);

    return null;
  }

  @ApiOperation({
    summary: 'Restore',
    description:
      "Requires the 'Restore' permission rule for the User Management module.",
  })
  @ApiParam({ name: 'id', description: 'User account ID (UUID)' })
  @ApiSuccessResponse(UserEntity, {
    description: 'User account restored successfully',
  })
  @ApiCommonErrorResponses()
  @Put(':id/restore')
  @RequireRule('Restore')
  @ResponseMessage('DATA_RESTORED_SUCCESS')
  async restore(@Req() req, @Param('id', UuidPipe) id: string) {
    const data = await this.userService.restore(
      id,
      req.user?.id,
      req,
      this.moduleName,
    );

    return data;
  }
}
