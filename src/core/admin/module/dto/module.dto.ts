import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { toBoolean } from 'src/common/helpers/transform.helper';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateModuleDto {
  @ApiProperty({
    description: 'Module name (must be unique across all modules)',
    example: 'Banner Management',
  })
  @IsNotEmpty({ message: 'IS_NOT_EMPTY' })
  @IsString({ message: 'IS_STRING' })
  name: string;

  @ApiPropertyOptional({
    description: 'Whether the module is active. Defaults to true when omitted',
    example: true,
    default: true,
  })
  @Transform(toBoolean)
  @IsBoolean({ message: 'IS_BOOLEAN' })
  @IsOptional()
  isActive?: boolean;
}

export class UpdateModuleDto {
  @ApiProperty({
    description: 'Module name (must be unique across all modules)',
    example: 'Banner Management',
  })
  @IsNotEmpty({ message: 'IS_NOT_EMPTY' })
  @IsString({ message: 'IS_STRING' })
  name: string;

  @ApiPropertyOptional({
    description:
      'Whether the module is active. Keeps its current value when omitted',
    example: true,
  })
  @Transform(toBoolean)
  @IsBoolean({ message: 'IS_BOOLEAN' })
  @IsOptional()
  isActive?: boolean;
}
