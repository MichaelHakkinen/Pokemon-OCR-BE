import { Transform } from 'class-transformer';
import { toBoolean } from 'src/common/helpers/transform.helper';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateModuleRuleDto {
  @ApiProperty({
    description: 'Id of the module this rule belongs to',
    example: 'd4e5f6a7-1b2c-4d3e-8f9a-0b1c2d3e4f5a',
  })
  @IsNotEmpty({ message: 'IS_NOT_EMPTY' })
  @IsUUID('4', { message: 'IS_UUID' })
  moduleId: string;

  @ApiPropertyOptional({
    description:
      'When true, ignores `name`/`description` and instead creates the standard set of ' +
      'CRUD rules (View List, View Details, Add New, Edit, Delete, Restore) for the module, ' +
      'skipping any that already exist. When false (default), `name` is required and a single ' +
      'rule is created.',
    example: false,
    default: false,
  })
  @Transform(toBoolean)
  @IsBoolean({ message: 'IS_BOOLEAN' })
  @IsNotEmpty()
  isPackage: boolean = false;

  @ApiPropertyOptional({
    description:
      'Rule name. Required when `isPackage` is false/omitted; ignored (and should be left ' +
      'unset) when `isPackage` is true.',
    example: 'View List',
  })
  @ValidateIf((o) => !o.isPackage)
  @IsNotEmpty({ message: 'IS_NOT_EMPTY' })
  @IsString({ message: 'IS_STRING' })
  name?: string;

  @ApiPropertyOptional({
    description:
      'Human-readable description of what the rule grants access to. Only used when ' +
      '`isPackage` is false/omitted; auto-generated for each rule when `isPackage` is true.',
    example: 'User can View List the Banner Management data',
  })
  @IsOptional()
  @IsString({ message: 'IS_STRING' })
  description?: string;
}

export class UpdateModuleRuleDto {
  @ApiProperty({
    description: 'Rule name, unique within its module',
    example: 'View List',
  })
  @IsNotEmpty({ message: 'IS_NOT_EMPTY' })
  @IsString({ message: 'IS_STRING' })
  name: string;

  @ApiPropertyOptional({
    description: 'Human-readable description of what the rule grants access to',
    example: 'User can View List the Banner Management data',
  })
  @IsOptional()
  @IsString({ message: 'IS_STRING' })
  description?: string;
}
