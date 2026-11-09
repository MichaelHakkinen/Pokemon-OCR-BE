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
  Req,
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
import { ModuleService } from './module.service';
import { CreateModuleDto, UpdateModuleDto } from './dto/module.dto';
import { ErrorMessageHelper } from 'src/common/helpers/error-message.helper';
import {
  ApiCommonErrorResponses,
  ApiSuccessNoDataResponse,
  ApiSuccessPaginationResponse,
  ApiSuccessResponse,
} from 'src/common/swagger/response.schemas';
import { ModuleEntity } from './entities/module.entity';
import { ResponseMessage } from 'src/common/decorators/response-message.decorator';
import { Paginated } from 'src/common/http/paginated';
import { UuidPipe } from 'src/pipes/uuid.pipe';
import { toDatatable } from 'src/common/http/datatable';

// Columns this list may be sorted by (anything else falls back to the default)
const MODULE_SORTABLE = ['name', 'isActive', 'createdAt', 'updatedAt'];

@ApiTags('Module')
@ApiBearerAuth()
@Controller('module')
@UseGuards(AdminAuthGuard, PermissionsGuard)
@RequireModule('Module Management')
export class ModuleController {
  private readonly moduleName: string = 'Module Management';

  constructor(
    private readonly moduleService: ModuleService,
    private readonly helper: HelperService,
  ) {}

  @ApiOperation({
    summary: 'List',
    description:
      'Returns a paginated list of modules. Requires the "View List" rule on the ' +
      'Module Management module.',
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
    example: 'createdAt',
    description: 'Column to sort by, defaults to "createdAt"',
  })
  @ApiQuery({
    name: 'sortDirection',
    required: false,
    enum: ['asc', 'desc'],
    example: 'desc',
    description: 'Sort direction, defaults to "desc"',
  })
  @ApiQuery({
    name: 'q',
    required: false,
    type: String,
    description: 'Search keyword, matched against module name',
  })
  @ApiSuccessPaginationResponse(ModuleEntity)
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
    const data = await this.moduleService.findAll(
      toDatatable(
        { page, limit, sort, sortDirection, q },
        { sortable: MODULE_SORTABLE },
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
      'Returns a single module. Requires the "View Details" rule on the Module ' +
      'Management module.',
  })
  @ApiParam({
    name: 'id',
    description: 'Module id (UUID)',
    example: 'd4e5f6a7-1b2c-4d3e-8f9a-0b1c2d3e4f5a',
  })
  @ApiSuccessResponse(ModuleEntity)
  @ApiCommonErrorResponses()
  @Get(':id')
  @RequireRule('View Details')
  @ResponseMessage('DATA_RETRIEVED_SUCCESS')
  async findOne(@Req() req, @Param('id', UuidPipe) id: string) {
    const data = await this.moduleService.findOne(
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
      'Creates a new module. Requires the "Add New" rule on the Module Management module.',
  })
  @ApiSuccessResponse(ModuleEntity, {
    status: HttpStatus.CREATED,
    description: 'Module created successfully',
  })
  @ApiCommonErrorResponses({ includeValidation: true })
  @Post()
  @RequireRule('Add New')
  @ResponseMessage('DATA_CREATED_SUCCESS')
  @HttpCode(HttpStatus.CREATED)
  async create(@Req() req, @Body() createModuleDto: CreateModuleDto) {
    // check if name already exists
    const module = await this.moduleService.checkNameExist(
      createModuleDto.name,
    );
    if (module) {
      throw new BadRequestException(
        ErrorMessageHelper.getMultiLanguageMessage('MODULE_NAME_EXISTS'),
      );
    }

    // create module
    const data = await this.moduleService.create(
      createModuleDto,
      req.user?.id,
      req,
      this.moduleName,
    );

    return data;
  }

  @ApiOperation({
    summary: 'Update',
    description:
      'Updates an existing module. Requires the "Edit" rule on the Module Management module.',
  })
  @ApiParam({
    name: 'id',
    description: 'Module id (UUID)',
    example: 'd4e5f6a7-1b2c-4d3e-8f9a-0b1c2d3e4f5a',
  })
  @ApiSuccessResponse(ModuleEntity, {
    description: 'Module updated successfully',
  })
  @ApiCommonErrorResponses({ includeValidation: true })
  @Put(':id')
  @RequireRule('Edit')
  @ResponseMessage('DATA_UPDATED_SUCCESS')
  async update(
    @Req() req,
    @Param('id', UuidPipe) id: string,
    @Body() updateModuleDto: UpdateModuleDto,
  ) {
    // check if name already exists (excluding current record)
    const existingModule = await this.moduleService.checkNameExist(
      updateModuleDto.name,
    );
    if (existingModule) {
      const existingModuleData = await this.moduleService.findOne(id);
      if (existingModuleData.name !== updateModuleDto.name) {
        throw new BadRequestException(
          ErrorMessageHelper.getMultiLanguageMessage('MODULE_NAME_EXISTS'),
        );
      }
    }

    // update module
    const data = await this.moduleService.update(
      id,
      updateModuleDto,
      req.user?.id,
      req,
      this.moduleName,
    );

    return data;
  }

  @ApiOperation({
    summary: 'Delete',
    description:
      'Soft-deletes a module (sets deletedAt). Requires the "Delete" rule on the ' +
      'Module Management module.',
  })
  @ApiParam({
    name: 'id',
    description: 'Module id (UUID)',
    example: 'd4e5f6a7-1b2c-4d3e-8f9a-0b1c2d3e4f5a',
  })
  @ApiSuccessNoDataResponse({ description: 'Module deleted successfully' })
  @ApiCommonErrorResponses()
  @Delete(':id')
  @RequireRule('Delete')
  @ResponseMessage('DATA_DELETED_SUCCESS')
  async delete(@Req() req, @Param('id', UuidPipe) id: string) {
    await this.moduleService.delete(id, req.user?.id, req, this.moduleName);

    return null;
  }

  @ApiOperation({
    summary: 'Restore',
    description:
      'Restores a previously soft-deleted module (clears deletedAt). Requires the ' +
      '"Restore" rule on the Module Management module. This endpoint takes no request ' +
      'body — only the module id in the path is used.',
  })
  @ApiParam({
    name: 'id',
    description: 'Module id (UUID)',
    example: 'd4e5f6a7-1b2c-4d3e-8f9a-0b1c2d3e4f5a',
  })
  @ApiSuccessResponse(ModuleEntity, {
    description: 'Module restored successfully',
  })
  @ApiCommonErrorResponses()
  @Put(':id/restore')
  @RequireRule('Restore')
  @ResponseMessage('DATA_RESTORED_SUCCESS')
  async restore(@Req() req, @Param('id', UuidPipe) id: string) {
    const data = await this.moduleService.restore(
      id,
      req.user?.id,
      req,
      this.moduleName,
    );

    return data;
  }
}
