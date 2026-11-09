import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ScanCardQueryDto {
  @ApiPropertyOptional({
    description: 'Language hint for OCR engine: auto, latin, japanese, korean, chinese',
    example: 'auto',
  })
  @IsOptional()
  @IsString()
  languageHint?: string;
}

export interface PythonOcrResponse {
  detected_script: string;
  name_candidates: string[];
  set_number_candidates: string[];
  set_code_candidates: string[];
  raw_header_text: string[];
  raw_footer_text: string[];
  processing_time_ms: number;
}

export interface MatchedCard {
  id: string;
  name: string;
  collectorNumber: string;
  normalizedNumber: string;
  rarity?: string | null;
  cardType?: string | null;
  supertype?: string | null;
  hp?: string | null;
  imageUrl?: string | null;
  setCode: string;
  setName: string;
  language: string;
  matchType: 'EXACT_CODE_AND_NUMBER' | 'PG_TRGM_FUZZY' | 'NORMALIZED_CJK';
  confidenceScore: number;
}

export class ScanCardResponseDto {
  @ApiProperty({ description: 'Script detected by vision service' })
  detectedScript: string;

  @ApiProperty({ description: 'Extracted card names from OCR header' })
  nameCandidates: string[];

  @ApiProperty({ description: 'Extracted card numbers from OCR footer' })
  setNumberCandidates: string[];

  @ApiProperty({ description: 'Extracted set codes from OCR footer' })
  setCodeCandidates: string[];

  @ApiProperty({ description: 'Matched card database records' })
  matchedCards: MatchedCard[];

  @ApiProperty({ description: 'Whether at least one card was matched' })
  isMatched: boolean;

  @ApiProperty({ description: 'Total OCR processing time in ms' })
  ocrTimeMs: number;
}

