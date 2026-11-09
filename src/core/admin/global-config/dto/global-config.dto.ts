import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateGlobalConfigDto {
  @ApiProperty({
    description: 'Config key, unique across all global configs',
    example: 'IS_MOBILE_MAINTENANCE',
  })
  @IsNotEmpty()
  @IsString()
  key: string;

  @ApiPropertyOptional({
    description: 'Config value, stored as text',
    example: 'false',
  })
  @IsOptional()
  @IsString()
  value?: string;
}

export class UpdateGlobalConfigDto {
  @ApiPropertyOptional({
    description:
      'Config value, stored as text. The key cannot be changed after creation',
    example: 'true',
  })
  @IsOptional()
  @IsString()
  value?: string;
}
