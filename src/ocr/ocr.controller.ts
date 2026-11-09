import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  Query,
  HttpCode,
  HttpStatus,
  ParseFilePipeBuilder,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiConsumes,
  ApiBody,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import { OcrService } from './ocr.service';
import { ScanCardQueryDto, ScanCardResponseDto } from './dto/ocr.dto';
import { ResponseMessage } from 'src/common/decorators/response-message.decorator';

@ApiTags('Pokemon Card OCR')
@Controller('ocr')
export class OcrController {
  constructor(private readonly ocrService: OcrService) {}

  @Post('scan')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Card scanned and processed successfully')
  @ApiOperation({
    summary: 'Scan and resolve Pokémon trading card from image',
    description:
      'Uploads a cropped card image (2.5:3.5 ratio), performs multilingual OCR via Python service, and matches card against database using set codes, numbers, and pg_trgm fuzzy matching.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['image'],
      properties: {
        image: {
          type: 'string',
          format: 'binary',
          description: 'Cropped card image (JPEG, PNG, WebP up to 10MB)',
        },
      },
    },
  })
  @ApiQuery({
    name: 'languageHint',
    required: false,
    enum: ['auto', 'latin', 'japanese', 'korean', 'chinese'],
    description: 'Language script hint for OCR engine',
  })
  @ApiResponse({
    status: 200,
    description: 'OCR analysis and matched card records',
    type: ScanCardResponseDto,
  })
  @UseInterceptors(FileInterceptor('image'))
  async scanCard(
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addMaxSizeValidator({ maxSize: 10 * 1024 * 1024 }) // 10MB
        .build({
          errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        }),
    )
    file: Express.Multer.File,
    @Query() query: ScanCardQueryDto,
  ): Promise<ScanCardResponseDto> {
    return this.ocrService.processCardImage(file, query.languageHint);
  }
}

