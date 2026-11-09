import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Req,
  Res,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { CollectionUserGuard } from './collection-user.guard';
import { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiBody,
} from '@nestjs/swagger';
import { CollectionService } from './collection.service';
import { AddToCollectionDto, UpdateExportConfigDto } from './dto/collection.dto';
import { ResponseMessage } from 'src/common/decorators/response-message.decorator';
import { RawResponse } from 'src/common/decorators/response-message.decorator';

@ApiTags('Collection & CSV Export')
@ApiBearerAuth()
@UseGuards(CollectionUserGuard)
@Controller('collection')
export class CollectionController {
  constructor(private readonly collectionService: CollectionService) {}

  /** The guard always sets req.user; never trust a raw header here. */
  private resolveUserId(req: any): string {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException();
    return userId;
  }

  @Get()
  @ApiOperation({ summary: 'Get current user card collection' })
  @ResponseMessage('DATA_RETRIEVED_SUCCESS')
  async getCollection(@Req() req: any) {
    const userId = this.resolveUserId(req);
    return this.collectionService.getUserCollection(userId);
  }

  @Post()
  @ApiOperation({ summary: 'Add card to user collection with optional custom fields' })
  @ResponseMessage('DATA_CREATED_SUCCESS')
  async addToCollection(@Req() req: any, @Body() dto: AddToCollectionDto) {
    const userId = this.resolveUserId(req);
    return this.collectionService.addToCollection(userId, dto);
  }

  @Get('export-config')
  @ApiOperation({
    summary: 'Get pre-export survey popup configuration and toggle status',
    description: 'Returns whether popup is enabled and array of custom field definitions.',
  })
  @ResponseMessage('DATA_RETRIEVED_SUCCESS')
  async getExportConfig(@Req() req: any) {
    const userId = this.resolveUserId(req);
    return this.collectionService.getExportConfig(userId);
  }

  @Put('export-config')
  @ApiOperation({
    summary: 'Update pre-export confirmation popup questions, options, and toggle state',
  })
  @ResponseMessage('DATA_UPDATED_SUCCESS')
  async updateExportConfig(@Req() req: any, @Body() dto: UpdateExportConfigDto) {
    const userId = this.resolveUserId(req);
    return this.collectionService.updateExportConfig(userId, dto);
  }

  @Get('export-csv')
  @RawResponse()
  @ApiOperation({
    summary: 'Download collection as CSV with standard and dynamic custom columns',
  })
  async exportCsvGet(@Req() req: any, @Res() res: Response) {
    const userId = this.resolveUserId(req);
    const csvContent = await this.collectionService.generateCollectionCsv(userId);

    const filename = `pokemon_collection_${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(HttpStatus.OK).send(csvContent);
  }

  @Post('export-csv')
  @RawResponse()
  @ApiOperation({
    summary: 'Download collection CSV populated with runtime responses from Pre-Export Survey Popup',
  })
  @ApiBody({
    description: 'Dynamic key-value responses matching the export fields configuration',
    schema: {
      type: 'object',
      example: {
        condition: 'Near Mint',
        graded: 'Raw',
        purchaseCurrency: 'USD',
        purchasePrice: 45.0,
        storageBoxId: 'Binder-02',
        notes: 'Mint condition holo bleed',
      },
    },
  })
  async exportCsvPost(
    @Req() req: any,
    @Body() surveyAnswers: Record<string, any>,
    @Res() res: Response,
  ) {
    const userId = this.resolveUserId(req);
    const csvContent = await this.collectionService.generateCollectionCsv(
      userId,
      surveyAnswers,
    );

    const filename = `pokemon_collection_${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(HttpStatus.OK).send(csvContent);
  }
}

