import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { toBoolean } from 'src/common/helpers/transform.helper';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAdminGroupDto {
  @ApiProperty({
    description: 'Name of the admin group',
    example: 'Content Editor',
  })
  @IsNotEmpty({ message: 'IS_NOT_EMPTY' })
  @IsString({ message: 'IS_STRING' })
  name: string;

  @ApiPropertyOptional({
    description: 'Whether the admin group is active',
    example: true,
    default: true,
  })
  @Transform(toBoolean)
  @IsBoolean({ message: 'IS_BOOLEAN' })
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({
    description:
      'Module rule IDs (UUIDs) to grant to this admin group, defining its permissions',
    example: [
      '3fa85f64-5717-4562-b3fc-2c963f66afa6',
      '4fa85f64-5717-4562-b3fc-2c963f66afb7',
    ],
    type: [String],
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (!value) return undefined;
    if (Array.isArray(value)) return value;
    try {
      return JSON.parse(value);
    } catch {
      return [value];
    }
  })
  @IsArray({ message: 'IS_ARRAY' })
  @IsUUID('4', { each: true, message: 'IS_UUID' })
  moduleRuleIds?: string[];
}

export class UpdateAdminGroupDto {
  @ApiProperty({
    description: 'Name of the admin group',
    example: 'Content Editor',
  })
  @IsNotEmpty({ message: 'IS_NOT_EMPTY' })
  @IsString({ message: 'IS_STRING' })
  name: string;

  @ApiPropertyOptional({
    description: 'Whether the admin group is active',
    example: true,
  })
  @Transform(toBoolean)
  @IsBoolean({ message: 'IS_BOOLEAN' })
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({
    description:
      'Module rule IDs (UUIDs) to grant to this admin group. Replaces all existing access records',
    example: [
      '3fa85f64-5717-4562-b3fc-2c963f66afa6',
      '4fa85f64-5717-4562-b3fc-2c963f66afb7',
    ],
    type: [String],
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (!value) return undefined;
    if (Array.isArray(value)) return value;
    try {
      return JSON.parse(value);
    } catch {
      return [value];
    }
  })
  @IsArray({ message: 'IS_ARRAY' })
  @IsUUID('4', { each: true, message: 'IS_UUID' })
  moduleRuleIds?: string[];
}
