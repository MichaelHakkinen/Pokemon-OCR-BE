import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
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
import { FAQService } from './faq.service';
import { CreateFAQDto, UpdateFAQDto } from './dto/faq.dto';
import { FAQSortingDto } from './dto/sorting.dto';
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
  ApiSuccessResponse,
} from 'src/common/swagger/response.schemas';
import { FaqEntity } from './entities/faq.entity';
import { ResponseMessage } from 'src/common/decorators/response-message.decorator';
import { UuidPipe } from 'src/pipes/uuid.pipe';
import { queryFlag, queryString } from 'src/common/http/datatable';

@ApiTags('FAQ')
@ApiBearerAuth()
@Controller('faq')
@UseGuards(AdminAuthGuard, PermissionsGuard)
@RequireModule('FAQ Management')
export class FAQController {
  private readonly faqName: string = 'FAQ Management';

  constructor(
    private readonly faqService: FAQService,
    private readonly helper: HelperService,
  ) {}

  @ApiOperation({
    summary: 'List',
    description:
      "Retrieves FAQs ordered by level and sort position, each including its parent and non-deleted children. Requires the 'View List' permission rule on the FAQ Management module.",
  })
  @ApiQuery({
    name: 'q',
    required: false,
    description: 'Search keyword, matched against FAQ text1 and text2',
    example: 'password',
  })
  @ApiQuery({
    name: 'deletedItems',
    required: false,
    description:
      'Set to "true" to include soft-deleted FAQs in the result, defaults to "false"',
    example: 'false',
  })
  @ApiQuery({
    name: 'parentId',
    required: false,
    description:
      'Filter by parent FAQ id. Use "null" for root level FAQs. Omit to return FAQs at every level',
    example: 'null',
  })
  @ApiSuccessResponse(FaqEntity, {
    description: 'FAQs retrieved successfully',
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
    @Query('parentId', new UuidPipe({ optional: true, allow: ['null'] }))
    parentId?: string,
  ) {
    const data = await this.faqService.findAll({
      search: queryString(q),
      deletedItems: queryFlag(deletedItems) ?? false,
      // omitted → every level, "null" → root level, otherwise that parent
      parentId: parentId === 'null' ? null : parentId || undefined,
    });

    return data;
  }

  @ApiOperation({
    summary: 'Detail',
    description:
      "Retrieves the details of a single, non-deleted FAQ, including its parent and children. Requires the 'View Details' permission rule on the FAQ Management module.",
  })
  @ApiParam({ name: 'id', description: 'FAQ id (UUID)' })
  @ApiSuccessResponse(FaqEntity, { description: 'FAQ retrieved successfully' })
  @ApiCommonErrorResponses()
  @Get(':id')
  @RequireRule('View Details')
  @ResponseMessage('DATA_RETRIEVED_SUCCESS')
  async findOne(@Req() req, @Param('id', UuidPipe) id: string) {
    const data = await this.faqService.findOne(
      id,
      req.user?.id,
      req,
      this.faqName,
    );

    return data;
  }

  @ApiOperation({
    summary: 'Create',
    description:
      "Creates a new FAQ, computing its level from the given parent (root when omitted) and appending it to the end of its level's sort order. Requires the 'Add New' permission rule on the FAQ Management module.",
  })
  @ApiSuccessResponse(FaqEntity, {
    description: 'FAQ created successfully',
    status: HttpStatus.CREATED,
  })
  @ApiCommonErrorResponses({ includeValidation: true })
  @Post()
  @RequireRule('Add New')
  @ResponseMessage('DATA_CREATED_SUCCESS')
  @HttpCode(HttpStatus.CREATED)
  async create(@Req() req, @Body() createFAQDto: CreateFAQDto) {
    // create faq
    const data = await this.faqService.create(
      createFAQDto,
      req.user?.id,
      req,
      this.faqName,
    );

    return data;
  }

  @ApiOperation({
    summary: 'Sorting',
    description:
      "Moves a FAQ to a new 1-based sort position among its siblings (same parent and level) and recalculates ordinals. Requires the 'Sorting' permission rule on the FAQ Management module.",
  })
  @ApiSuccessResponse(FaqEntity, {
    description: 'FAQ sorting updated successfully',
  })
  @ApiCommonErrorResponses({ includeValidation: true })
  @Put('sorting')
  @RequireRule('Sorting')
  @ResponseMessage('SORTING_UPDATED_SUCCESS')
  async sorting(@Req() req, @Body() faqSortingDto: FAQSortingDto) {
    const data = await this.faqService.sorting(faqSortingDto);

    return data;
  }

  @ApiOperation({
    summary: 'Update',
    description:
      "Updates an existing FAQ's fields; changing parentId recalculates its level and cascades the new level to all descendants. Requires the 'Edit' permission rule on the FAQ Management module.",
  })
  @ApiParam({ name: 'id', description: 'FAQ id (UUID)' })
  @ApiSuccessResponse(FaqEntity, { description: 'FAQ updated successfully' })
  @ApiCommonErrorResponses({ includeValidation: true })
  @Put(':id')
  @RequireRule('Edit')
  @ResponseMessage('DATA_UPDATED_SUCCESS')
  async update(
    @Req() req,
    @Param('id', UuidPipe) id: string,
    @Body() updateFAQDto: UpdateFAQDto,
  ) {
    // update faq
    const data = await this.faqService.update(
      id,
      updateFAQDto,
      req.user?.id,
      req,
      this.faqName,
    );

    return data;
  }

  @ApiOperation({
    summary: 'Delete',
    description:
      "Soft-deletes a FAQ. Requires the 'Delete' permission rule on the FAQ Management module.",
  })
  @ApiParam({ name: 'id', description: 'FAQ id (UUID)' })
  @ApiSuccessNoDataResponse({ description: 'FAQ deleted successfully' })
  @ApiCommonErrorResponses()
  @Delete(':id')
  @RequireRule('Delete')
  @ResponseMessage('DATA_DELETED_SUCCESS')
  async delete(@Req() req, @Param('id', UuidPipe) id: string) {
    await this.faqService.delete(id, req.user?.id, req, this.faqName);

    return null;
  }

  @ApiOperation({
    summary: 'Restore',
    description:
      "Restores a previously soft-deleted FAQ by clearing its deletedAt timestamp. Requires the 'Restore' permission rule on the FAQ Management module.",
  })
  @ApiParam({ name: 'id', description: 'FAQ id (UUID)' })
  @ApiSuccessResponse(FaqEntity, { description: 'FAQ restored successfully' })
  @ApiCommonErrorResponses()
  @Put(':id/restore')
  @RequireRule('Restore')
  @ResponseMessage('DATA_RESTORED_SUCCESS')
  async restore(@Req() req, @Param('id', UuidPipe) id: string) {
    const data = await this.faqService.restore(
      id,
      req.user?.id,
      req,
      this.faqName,
    );

    return data;
  }
}
