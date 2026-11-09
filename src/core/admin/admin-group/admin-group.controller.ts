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
import { AdminAuthGuard } from 'src/guards/AdminAuth.guard';
import { PermissionsGuard } from 'src/guards/Permission.guard';
import {
  RequireModule,
  RequireRule,
} from 'src/common/decorators/permission.decorator';
import { HelperService } from 'src/utils/helper.service';
import { AdminGroupService } from './admin-group.service';
import {
  CreateAdminGroupDto,
  UpdateAdminGroupDto,
} from './dto/admin-group.dto';
import { ErrorMessageHelper } from 'src/common/helpers/error-message.helper';
import {
  ApiBearerAuth,
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
import { AdminGroupEntity } from './entities/admin-group.entity';
import { ResponseMessage } from 'src/common/decorators/response-message.decorator';
import { Paginated } from 'src/common/http/paginated';
import { UuidPipe } from 'src/pipes/uuid.pipe';
import { toDatatable } from 'src/common/http/datatable';

// Columns this list may be sorted by (anything else falls back to the default)
const ADMIN_GROUP_SORTABLE = ['name', 'isActive', 'createdAt', 'updatedAt'];

@ApiTags('Admin Group')
@ApiBearerAuth()
@Controller('admin-group')
@UseGuards(AdminAuthGuard, PermissionsGuard)
@RequireModule('Admin Group Management')
export class AdminGroupController {
  private readonly moduleName: string = 'Admin Group Management';

  constructor(
    private readonly adminGroupService: AdminGroupService,
    private readonly helper: HelperService,
  ) {}

  @Get()
  @RequireRule('View List')
  @ApiOperation({
    summary: 'List',
    description:
      "Retrieve a paginated list of admin groups (excludes the internal '*root' group). Requires the 'View List' permission rule in the Admin Group Management module.",
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
    description: 'Search keyword, matched against the group name',
    example: 'Content Editor',
  })
  @ApiSuccessPaginationResponse(AdminGroupEntity, {
    description: 'Admin groups retrieved successfully',
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
    const data = await this.adminGroupService.findAll(
      toDatatable(
        { page, limit, sort, sortDirection, q },
        { sortable: ADMIN_GROUP_SORTABLE },
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
      "Retrieve the details of a single admin group by ID, including its members and granted module rules. Requires the 'View Details' permission rule in the Admin Group Management module.",
  })
  @ApiParam({
    name: 'id',
    description: 'Admin group ID',
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
  })
  @ApiSuccessResponse(AdminGroupEntity, {
    description: 'Admin group retrieved successfully',
  })
  @ApiCommonErrorResponses()
  @ResponseMessage('DATA_RETRIEVED_SUCCESS')
  async findOne(@Req() req, @Param('id', UuidPipe) id: string) {
    const data = await this.adminGroupService.findOne(
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
      "Create a new admin group and optionally grant it a set of module rules. Requires the 'Add New' permission rule in the Admin Group Management module.",
  })
  @ApiSuccessResponse(AdminGroupEntity, {
    description: 'Admin group created successfully',
    status: HttpStatus.CREATED,
  })
  @ApiCommonErrorResponses({ includeValidation: true })
  @ResponseMessage('DATA_CREATED_SUCCESS')
  @HttpCode(HttpStatus.CREATED)
  async create(@Req() req, @Body() createAdminGroupDto: CreateAdminGroupDto) {
    // check if name already exists
    const adminGroup = await this.adminGroupService.checkNameExist(
      createAdminGroupDto.name,
    );
    if (adminGroup) {
      throw new BadRequestException(
        ErrorMessageHelper.getMultiLanguageMessage('ADMIN_GROUP_NAME_EXISTS'),
      );
    }

    // create admin group
    const data = await this.adminGroupService.create(
      createAdminGroupDto,
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
      "Update an existing admin group's name, active status, and granted module rules (replaces all existing access records). Requires the 'Edit' permission rule in the Admin Group Management module.",
  })
  @ApiParam({
    name: 'id',
    description: 'Admin group ID',
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
  })
  @ApiSuccessResponse(AdminGroupEntity, {
    description: 'Admin group updated successfully',
  })
  @ApiCommonErrorResponses({ includeValidation: true })
  @ResponseMessage('DATA_UPDATED_SUCCESS')
  async update(
    @Req() req,
    @Param('id', UuidPipe) id: string,
    @Body() updateAdminGroupDto: UpdateAdminGroupDto,
  ) {
    // check if name already exists (excluding current record)
    const existingGroup = await this.adminGroupService.checkNameExist(
      updateAdminGroupDto.name,
    );
    if (existingGroup) {
      const existingGroupData = await this.adminGroupService.findOne(id);
      if (existingGroupData.name !== updateAdminGroupDto.name) {
        throw new BadRequestException(
          ErrorMessageHelper.getMultiLanguageMessage('ADMIN_GROUP_NAME_EXISTS'),
        );
      }
    }

    // update admin group
    const data = await this.adminGroupService.update(
      id,
      updateAdminGroupDto,
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
      "Soft-delete an admin group. Requires the 'Delete' permission rule in the Admin Group Management module.",
  })
  @ApiParam({
    name: 'id',
    description: 'Admin group ID',
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
  })
  @ApiSuccessNoDataResponse({ description: 'Admin group deleted successfully' })
  @ApiCommonErrorResponses()
  @ResponseMessage('DATA_DELETED_SUCCESS')
  async delete(@Req() req, @Param('id', UuidPipe) id: string) {
    await this.adminGroupService.delete(id, req.user?.id, req, this.moduleName);

    return null;
  }

  @Put(':id/restore')
  @RequireRule('Restore')
  @ApiOperation({
    summary: 'Restore',
    description:
      "Restore a soft-deleted admin group. Requires the 'Restore' permission rule in the Admin Group Management module.",
  })
  @ApiParam({
    name: 'id',
    description: 'Admin group ID',
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
  })
  @ApiSuccessResponse(AdminGroupEntity, {
    description: 'Admin group restored successfully',
  })
  @ApiCommonErrorResponses()
  @ResponseMessage('DATA_RESTORED_SUCCESS')
  async restore(@Req() req, @Param('id', UuidPipe) id: string) {
    const data = await this.adminGroupService.restore(
      id,
      req.user?.id,
      req,
      this.moduleName,
    );

    return data;
  }
}
