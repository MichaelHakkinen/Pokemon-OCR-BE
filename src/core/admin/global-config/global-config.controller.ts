import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
  Req,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { AdminAuthGuard } from 'src/guards/AdminAuth.guard';
import { PermissionsGuard } from 'src/guards/Permission.guard';
import {
  RequireModule,
  RequireRule,
} from 'src/common/decorators/permission.decorator';
import { HelperService } from 'src/utils/helper.service';
import { GlobalConfigService } from './global-config.service';
import {
  CreateGlobalConfigDto,
  UpdateGlobalConfigDto,
} from './dto/global-config.dto';
import {
  ApiCommonErrorResponses,
  ApiSuccessNoDataResponse,
  ApiSuccessPaginationResponse,
  ApiSuccessResponse,
} from 'src/common/swagger/response.schemas';
import { GlobalConfigEntity } from './entities/global-config.entity';
import { ResponseMessage } from 'src/common/decorators/response-message.decorator';
import { Paginated } from 'src/common/http/paginated';
import { UuidPipe } from 'src/pipes/uuid.pipe';
import { toDatatable } from 'src/common/http/datatable';

// Columns this list may be sorted by (anything else falls back to the default)
const GLOBAL_CONFIG_SORTABLE = ['key', 'value', 'createdAt', 'updatedAt'];

@ApiTags('Global Config')
@ApiBearerAuth()
@Controller('admin/global-config')
@UseGuards(AdminAuthGuard, PermissionsGuard)
@RequireModule('Global Config Management')
export class GlobalConfigController {
  private readonly moduleName: string = 'Global Config Management';

  constructor(
    private readonly globalConfigService: GlobalConfigService,
    private readonly helper: HelperService,
  ) {}

  @ApiOperation({
    summary: 'List',
    description:
      'Returns a paginated list of global configs. Requires the "View List" rule ' +
      'on the Global Config Management module.',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    example: 1,
    description: 'Page number, defaults to 1',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    example: 10,
    description: 'Rows per page, defaults to 10',
  })
  @ApiQuery({
    name: 'sort',
    required: false,
    type: String,
    example: 'key',
    description: 'Column to sort by, defaults to "key"',
  })
  @ApiQuery({
    name: 'sortDirection',
    required: false,
    enum: ['asc', 'desc'],
    example: 'asc',
    description: 'Sort direction, defaults to "asc"',
  })
  @ApiQuery({
    name: 'q',
    required: false,
    type: String,
    description: 'Search keyword, matched against config key and value',
  })
  @ApiSuccessPaginationResponse(GlobalConfigEntity)
  @ApiCommonErrorResponses()
  @Get()
  @RequireRule('View List')
  @ResponseMessage('DATA_RETRIEVED_SUCCESS')
  @HttpCode(200)
  async findAll(
    @Req() req,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
    @Query('sort') sort: string = 'key',
    @Query('sortDirection') sortDirection: string = 'asc',
    @Query('q') q: string = null,
  ) {
    // Bad paging/sort values are fixed up, never passed to Prisma
    const data = await this.globalConfigService.findAll(
      toDatatable(
        { page, limit, sort, sortDirection, q },
        {
          sortable: GLOBAL_CONFIG_SORTABLE,
          defaultSort: 'key',
          defaultDirection: 'asc',
        },
      ),
    );
    return new Paginated(data.pagination, data.data);
  }

  @ApiOperation({
    summary: 'Detail',
    description:
      'Returns a single global config. Requires the "View Details" rule on the ' +
      'Global Config Management module.',
  })
  @ApiParam({
    name: 'id',
    description: 'Global config id (UUID)',
    example: 'f1e2d3c4-b5a6-4978-8697-0a1b2c3d4e5f',
  })
  @ApiSuccessResponse(GlobalConfigEntity)
  @ApiCommonErrorResponses()
  @Get(':id')
  @RequireRule('View Details')
  @ResponseMessage('DATA_RETRIEVED_SUCCESS')
  @HttpCode(200)
  async findOne(@Req() req, @Param('id', UuidPipe) id: string) {
    const data = await this.globalConfigService.findOne(
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
      'Creates a new global config entry. Requires the "Add New" rule on the ' +
      'Global Config Management module.',
  })
  @ApiSuccessResponse(GlobalConfigEntity, {
    status: 201,
    description: 'Global config created successfully',
  })
  @ApiCommonErrorResponses({ includeValidation: true })
  @Post()
  @RequireRule('Add New')
  @ResponseMessage('DATA_CREATED_SUCCESS')
  @HttpCode(201)
  async create(@Req() req, @Body() createDto: CreateGlobalConfigDto) {
    const data = await this.globalConfigService.create(
      createDto,
      req.user?.id,
      req,
      this.moduleName,
    );
    return data;
  }

  @ApiOperation({
    summary: 'Update',
    description:
      'Updates the value of an existing global config entry. The key cannot be ' +
      'changed. Requires the "Edit" rule on the Global Config Management module. If the ' +
      'config key is one of the cached keys (IS_MOBILE_MAINTENANCE, IS_WEBSITE_MAINTENANCE, ' +
      'ANDROID_MIN_VERSION, IOS_MIN_VERSION), its Redis cache entry is invalidated.',
  })
  @ApiParam({
    name: 'id',
    description: 'Global config id (UUID)',
    example: 'f1e2d3c4-b5a6-4978-8697-0a1b2c3d4e5f',
  })
  @ApiSuccessResponse(GlobalConfigEntity, {
    description: 'Global config updated successfully',
  })
  @ApiCommonErrorResponses({ includeValidation: true })
  @Put(':id')
  @RequireRule('Edit')
  @ResponseMessage('DATA_UPDATED_SUCCESS')
  @HttpCode(200)
  async update(
    @Req() req,
    @Param('id', UuidPipe) id: string,
    @Body() updateDto: UpdateGlobalConfigDto,
  ) {
    const data = await this.globalConfigService.update(
      id,
      updateDto,
      req.user?.id,
      req,
      this.moduleName,
    );
    return data;
  }

  @ApiOperation({
    summary: 'Delete',
    description:
      'Permanently (hard) deletes a global config entry — GlobalConfig has no ' +
      'deletedAt column, so this is not recoverable. Requires the "Delete" rule on the ' +
      'Global Config Management module. If the key is one of the cached keys, its Redis ' +
      'cache entry is invalidated.',
  })
  @ApiParam({
    name: 'id',
    description: 'Global config id (UUID)',
    example: 'f1e2d3c4-b5a6-4978-8697-0a1b2c3d4e5f',
  })
  @ApiSuccessNoDataResponse({
    description: 'Global config deleted successfully',
  })
  @ApiCommonErrorResponses()
  @Delete(':id')
  @RequireRule('Delete')
  @ResponseMessage('DATA_DELETED_SUCCESS')
  @HttpCode(200)
  async delete(@Req() req, @Param('id', UuidPipe) id: string) {
    await this.globalConfigService.delete(
      id,
      req.user?.id,
      req,
      this.moduleName,
    );
    return null;
  }
}
