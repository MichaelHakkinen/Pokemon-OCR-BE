import { Injectable, Logger, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { CardResolutionService } from './card-resolution.service';
import { PythonOcrResponse, ScanCardResponseDto } from './dto/ocr.dto';

@Injectable()
export class OcrService {
  private readonly logger = new Logger(OcrService.name);
  private readonly ocrServiceUrl: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly resolutionService: CardResolutionService,
  ) {
    this.ocrServiceUrl =
      this.configService.get<string>('OCR_SERVICE_URL') || 'http://localhost:8000';
  }

  /**
   * Forwards cropped image buffer to Python FastAPI OCR microservice,
   * then triggers database resolution.
   */
  async processCardImage(
    file: Express.Multer.File,
    languageHint?: string,
  ): Promise<ScanCardResponseDto> {
    if (!file || !file.buffer) {
      throw new BadRequestException('No image file provided for OCR scanning.');
    }

    try {
      this.logger.log(
        `Forwarding card image (${file.size} bytes) to OCR service at ${this.ocrServiceUrl}...`,
      );

      // Build native FormData with Blob for multipart file upload
      const formData = new FormData();
      const blob = new Blob([file.buffer], { type: file.mimetype || 'image/jpeg' });
      formData.append('image', blob, file.originalname || 'card.jpg');

      const url = new URL(`${this.ocrServiceUrl}/extract-card-text`);
      if (languageHint) {
        url.searchParams.append('language_hint', languageHint);
      }

      const ocrResponse = await axios.post<PythonOcrResponse>(
        url.toString(),
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          timeout: 15000,
        },
      );

      const ocrData = ocrResponse.data;
      this.logger.log(
        `OCR extraction succeeded: Detected [${ocrData.detected_script}], Candidates: ${ocrData.name_candidates.length} names, ${ocrData.set_number_candidates.length} numbers`,
      );

      // Resolve card candidates in PostgreSQL
      const matchedCards = await this.resolutionService.resolveCard(ocrData);

      return {
        detectedScript: ocrData.detected_script,
        nameCandidates: ocrData.name_candidates,
        setNumberCandidates: ocrData.set_number_candidates,
        setCodeCandidates: ocrData.set_code_candidates,
        matchedCards,
        isMatched: matchedCards.length > 0,
        ocrTimeMs: ocrData.processing_time_ms,
      };
    } catch (error: any) {
      this.logger.error(
        `OCR microservice communication failure: ${error.message}`,
        error.stack,
      );
      if (error.response) {
        throw new BadRequestException(
          `OCR service error: ${JSON.stringify(error.response.data)}`,
        );
      }
      throw new InternalServerErrorException(
        `Failed to reach OCR microservice at ${this.ocrServiceUrl}. Ensure the Python service is running.`,
      );
    }
  }
}

