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
  ApiExtraModels,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { AdminAuthGuard } from 'src/guards/AdminAuth.guard';
import { PermissionsGuard } from 'src/guards/Permission.guard';
import {
  RequireModule,
  RequireRule,
} from 'src/common/decorators/permission.decorator';
import { HelperService } from 'src/utils/helper.service';
import { ErrorMessageHelper } from 'src/common/helpers/error-message.helper';
import { ModuleRuleService } from './module-rule.service';
import {
  CreateModuleRuleDto,
  UpdateModuleRuleDto,
} from './dto/module-rule.dto';
import {
  ApiCommonErrorResponses,
  ApiSuccessNoDataResponse,
  ApiSuccessPaginationResponse,
  ApiSuccessResponse,
} from 'src/common/swagger/response.schemas';
import {
  ModuleRuleEntity,
  ModuleRulePackageCreateEntity,
} from './entities/module-rule.entity';
import { ResponseMessage } from 'src/common/decorators/response-message.decorator';
import { Paginated } from 'src/common/http/paginated';
import { UuidPipe } from 'src/pipes/uuid.pipe';
import { toDatatable } from 'src/common/http/datatable';

// Columns this list may be sorted by (anything else falls back to the default)
const MODULE_RULE_SORTABLE = ['name', 'description', 'createdAt', 'updatedAt'];

@ApiTags('Module Rule')
@ApiBearerAuth()
@Controller('module-rule')
@UseGuards(AdminAuthGuard, PermissionsGuard)
@RequireModule('Module Rule Management')
export class ModuleRuleController {
  private readonly moduleName: string = 'Module Rule Management';

  constructor(
    private readonly moduleRuleService: ModuleRuleService,
    private readonly helper: HelperService,
  ) {}

  @ApiOperation({
    summary: 'List',
    description:
      'Returns a paginated list of module rules. Requires the "View List" rule on ' +
      'the Module Rule Management module.',
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
    name: 'moduleId',
    required: false,
    type: String,
    description: 'Filter rules belonging to a specific module id (UUID)',
  })
  @ApiQuery({
    name: 'q',
    required: false,
    type: String,
    description: 'Search keyword, matched against rule name',
  })
  @ApiSuccessPaginationResponse(ModuleRuleEntity)
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
    @Query('moduleId', new UuidPipe({ optional: true }))
    moduleId: string = null,
    @Query('q') q: string = null,
  ) {
    // Bad paging/sort values are fixed up, never passed to Prisma
    const data = await this.moduleRuleService.findAll(
      toDatatable(
        { page, limit, sort, sortDirection, q },
        { sortable: MODULE_RULE_SORTABLE, filter: { moduleId: moduleId } },
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
      'Returns a single module rule. Requires the "View Details" rule on the ' +
      'Module Rule Management module.',
  })
  @ApiParam({
    name: 'id',
    description: 'Module rule id (UUID)',
    example: 'a1b2c3d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
  })
  @ApiSuccessResponse(ModuleRuleEntity)
  @ApiCommonErrorResponses()
  @Get(':id')
  @RequireRule('View Details')
  @ResponseMessage('DATA_RETRIEVED_SUCCESS')
  async findOne(@Req() req, @Param('id', UuidPipe) id: string) {
    const data = await this.moduleRuleService.findOne(
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
      'Creates a new module rule. Requires the "Add New" rule on the Module Rule ' +
      'Management module. When `isPackage` is true in the body, this instead creates the ' +
      'standard set of CRUD rules (View List, View Details, Add New, Edit, Delete, Restore) ' +
      'for the module and returns a package-creation summary instead of a single rule.',
  })
  @ApiExtraModels(ModuleRuleEntity, ModuleRulePackageCreateEntity)
  @ApiResponse({
    status: HttpStatus.CREATED,
    description:
      'Module rule created successfully. `data` is a single rule when `isPackage` is ' +
      'false/omitted, or a package-creation summary when `isPackage` is true.',
    schema: {
      properties: {
        code: { type: 'number', example: HttpStatus.CREATED },
        status: { type: 'string', example: 'success' },
        message: { type: 'string', example: 'Data created successfully' },
        data: {
          oneOf: [
            { $ref: getSchemaPath(ModuleRuleEntity) },
            { $ref: getSchemaPath(ModuleRulePackageCreateEntity) },
          ],
        },
      },
    },
  })
  @ApiCommonErrorResponses({ includeValidation: true })
  @Post()
  @RequireRule('Add New')
  @ResponseMessage('DATA_CREATED_SUCCESS')
  @HttpCode(HttpStatus.CREATED)
  async create(@Req() req, @Body() createModuleRuleDto: CreateModuleRuleDto) {
    // check if rule already exists for the module
    const ruleExists = await this.moduleRuleService.checkNameExist(
      createModuleRuleDto.name,
      createModuleRuleDto.moduleId,
    );
    if (ruleExists) {
      throw new BadRequestException(
        ErrorMessageHelper.getMultiLanguageMessage(
          'MODULE_RULE_ALREADY_EXISTS',
        ),
      );
    }

    // create module rule
    const data = await this.moduleRuleService.create(
      createModuleRuleDto,
      req.user?.id,
      req,
      this.moduleName,
    );

    return data;
  }

  @ApiOperation({
    summary: 'Update',
    description:
      'Updates an existing module rule. Requires the "Edit" rule on the Module Rule ' +
      'Management module.',
  })
  @ApiParam({
    name: 'id',
    description: 'Module rule id (UUID)',
    example: 'a1b2c3d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
  })
  @ApiSuccessResponse(ModuleRuleEntity, {
    description: 'Module rule updated successfully',
  })
  @ApiCommonErrorResponses({ includeValidation: true })
  @Put(':id')
  @RequireRule('Edit')
  @ResponseMessage('DATA_UPDATED_SUCCESS')
  async update(
    @Req() req,
    @Param('id', UuidPipe) id: string,
    @Body() updateModuleRuleDto: UpdateModuleRuleDto,
  ) {
    // check is name already exists for the module (excluding current rule)
    const ruleExists = await this.moduleRuleService.findOne(id);
    if (!ruleExists) {
      throw new BadRequestException(
        ErrorMessageHelper.getMultiLanguageMessage('MODULE_RULE_NOT_FOUND'),
      );
    }

    // If the name is being changed, check for duplicates (excluding current record)
    if (ruleExists.name !== updateModuleRuleDto.name) {
      const duplicateRule = await this.moduleRuleService.checkNameExist(
        updateModuleRuleDto.name,
        ruleExists.moduleId,
      );
      if (duplicateRule) {
        throw new BadRequestException(
          ErrorMessageHelper.getMultiLanguageMessage(
            'MODULE_RULE_ALREADY_EXISTS',
          ),
        );
      }
    }

    // update module
    const data = await this.moduleRuleService.update(
      id,
      updateModuleRuleDto,
      req.user?.id,
      req,
      this.moduleName,
    );

    return data;
  }

  @ApiOperation({
    summary: 'Delete',
    description:
      'Soft-deletes a module rule (sets deletedAt). Requires the "Delete" rule on ' +
      'the Module Rule Management module.',
  })
  @ApiParam({
    name: 'id',
    description: 'Module rule id (UUID)',
    example: 'a1b2c3d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
  })
  @ApiSuccessNoDataResponse({ description: 'Module rule deleted successfully' })
  @ApiCommonErrorResponses()
  @Delete(':id')
  @RequireRule('Delete')
  @ResponseMessage('DATA_DELETED_SUCCESS')
  async delete(@Req() req, @Param('id', UuidPipe) id: string) {
    await this.moduleRuleService.delete(id, req.user?.id, req, this.moduleName);

    return null;
  }

  @ApiOperation({
    summary: 'Restore',
    description:
      'Restores a previously soft-deleted module rule (clears deletedAt). Requires ' +
      'the "Restore" rule on the Module Rule Management module. This endpoint takes no ' +
      'request body — only the module rule id in the path is used.',
  })
  @ApiParam({
    name: 'id',
    description: 'Module rule id (UUID)',
    example: 'a1b2c3d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
  })
  @ApiSuccessResponse(ModuleRuleEntity, {
    description: 'Module rule restored successfully',
  })
  @ApiCommonErrorResponses()
  @Put(':id/restore')
  @RequireRule('Restore')
  @ResponseMessage('DATA_RESTORED_SUCCESS')
  async restore(@Req() req, @Param('id', UuidPipe) id: string) {
    const data = await this.moduleRuleService.restore(
      id,
      req.user?.id,
      req,
      this.moduleName,
    );

    return data;
  }
}
