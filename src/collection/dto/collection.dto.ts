import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export enum FieldType {
  TEXT = 'text',
  DROPDOWN = 'dropdown',
  CHECKBOX = 'checkbox',
  NUMBER = 'number',
}

export class ExportFieldDefinitionDto {
  @ApiProperty({ example: 'condition', description: 'Unique identifier for CSV column key' })
  @IsString()
  @IsNotEmpty()
  key: string;

  @ApiProperty({ example: 'Condition', description: 'Label shown in survey popup modal' })
  @IsString()
  @IsNotEmpty()
  label: string;

  @ApiProperty({ enum: FieldType, example: FieldType.DROPDOWN, description: 'UI input type' })
  @IsEnum(FieldType)
  type: FieldType;

  @ApiPropertyOptional({
    type: [String],
    example: ['Mint', 'Near Mint', 'Lightly Played', 'Played', 'Damaged'],
    description: 'Options required if type is dropdown',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  options?: string[];

  @ApiPropertyOptional({ example: 'Near Mint', description: 'Default pre-filled value' })
  @IsOptional()
  defaultValue?: any;

  @ApiPropertyOptional({ example: true, description: 'Whether field is mandatory in dialog' })
  @IsOptional()
  @IsBoolean()
  required?: boolean;
}

export class UpdateExportConfigDto {
  @ApiProperty({
    example: true,
    description: 'Global toggle: Enable/Disable Pre-Export Confirmation / Survey Popup',
  })
  @IsBoolean()
  isEnabled: boolean;

  @ApiProperty({
    type: [ExportFieldDefinitionDto],
    description: 'Dynamic question fields to display in pre-export survey dialog',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExportFieldDefinitionDto)
  fields: ExportFieldDefinitionDto[];
}

export class AddToCollectionDto {
  @ApiProperty({ example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', description: 'Card UUID' })
  @IsUUID()
  cardId: string;

  @ApiPropertyOptional({ example: 'NM', description: 'Card condition: Mint, NM, LP, MP, HP' })
  @IsOptional()
  @IsString()
  condition?: string;

  @ApiPropertyOptional({ example: 'Raw', description: 'Grade: Raw, PSA 10, BGS 9.5, etc.' })
  @IsOptional()
  @IsString()
  grade?: string;

  @ApiPropertyOptional({ example: 'en', description: 'Language script: en, ja, id, etc.' })
  @IsOptional()
  @IsString()
  language?: string;

  @ApiPropertyOptional({ example: 1, description: 'Quantity collected' })
  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;

  @ApiPropertyOptional({
    example: {
      storageBoxId: 'BOX-A1',
      purchasePrice: 150000,
      purchaseCurrency: 'IDR',
      notes: 'Holo bleed error',
    },
    description: 'Arbitrary dynamic key-value pairs captured from survey or user input',
  })
  @IsOptional()
  @IsObject()
  customFields?: Record<string, any>;
}

