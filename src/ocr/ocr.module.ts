import { Module } from '@nestjs/common';
import { OcrController } from './ocr.controller';
import { OcrService } from './ocr.service';
import { CardResolutionService } from './card-resolution.service';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [OcrController],
  providers: [OcrService, CardResolutionService],
  exports: [OcrService, CardResolutionService],
})
export class OcrModule {}

