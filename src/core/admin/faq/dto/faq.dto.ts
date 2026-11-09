import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { toBoolean } from 'src/common/helpers/transform.helper';
import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';

export class CreateFAQDto {
  @ApiPropertyOptional({
    description:
      'Parent FAQ id to nest this FAQ under. Omit or leave empty for a root-level FAQ',
    example: '7c1e4b2a-3d5f-4a6b-8c9d-1e2f3a4b5c6d',
  })
  @IsOptional()
  @IsUUID('all', { message: 'IS_UUID' })
  parentId?: string;

  @ApiProperty({
    description: 'Question text',
    example: 'How do I reset my password?',
  })
  @IsNotEmpty({ message: 'IS_NOT_EMPTY' })
  @IsString({ message: 'IS_STRING' })
  text1: string;

  @ApiProperty({
    description: 'Answer text',
    example: 'Go to Settings > Security > Reset Password.',
  })
  @IsNotEmpty({ message: 'IS_NOT_EMPTY' })
  @IsString({ message: 'IS_STRING' })
  text2: string;

  @ApiPropertyOptional({
    description: 'Whether the FAQ is active. Defaults to true when omitted',
    example: true,
    default: true,
  })
  @Transform(toBoolean)
  @IsBoolean({ message: 'IS_BOOLEAN' })
  @IsOptional()
  isActive?: boolean;
}

export class UpdateFAQDto {
  @ApiPropertyOptional({
    description:
      'Parent FAQ id to nest this FAQ under. Omit or leave empty for a root-level FAQ',
    example: '7c1e4b2a-3d5f-4a6b-8c9d-1e2f3a4b5c6d',
  })
  @IsOptional()
  @IsUUID('all', { message: 'IS_UUID' })
  parentId?: string;

  @ApiProperty({
    description: 'Question text',
    example: 'How do I reset my password?',
  })
  @IsNotEmpty({ message: 'IS_NOT_EMPTY' })
  @IsString({ message: 'IS_STRING' })
  text1: string;

  @ApiProperty({
    description: 'Answer text',
    example: 'Go to Settings > Security > Reset Password.',
  })
  @IsNotEmpty({ message: 'IS_NOT_EMPTY' })
  @IsString({ message: 'IS_STRING' })
  text2: string;

  @ApiPropertyOptional({
    description: 'Whether the FAQ is active',
    example: true,
  })
  @Transform(toBoolean)
  @IsBoolean({ message: 'IS_BOOLEAN' })
  @IsOptional()
  isActive?: boolean;
}
