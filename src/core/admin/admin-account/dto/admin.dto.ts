import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  IsUUID,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { toBoolean } from 'src/common/helpers/transform.helper';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NormalizeEmail } from 'src/common/helpers/email.helper';

export class CreateAdminDto {
  @ApiProperty({
    description: 'Full name of the admin',
    example: 'Farhan Taufik Hidayat',
  })
  @IsNotEmpty({ message: 'IS_NOT_EMPTY' })
  @IsString({ message: 'IS_STRING' })
  fullname: string;

  @ApiPropertyOptional({
    description: 'Email address of the admin',
    example: 'farhan@team.superfk.co',
  })
  @IsOptional()
  @IsEmail({}, { message: 'IS_EMAIL' })
  @NormalizeEmail()
  email: string;

  @ApiProperty({
    description: 'Login username, minimum 4 characters',
    example: 'farhanth',
    minLength: 4,
  })
  @IsNotEmpty({ message: 'IS_NOT_EMPTY' })
  @IsString({ message: 'IS_STRING' })
  @MinLength(4, { message: 'MIN_LENGTH' })
  username: string;

  @ApiProperty({
    description: 'Phone number of the admin',
    example: '+6281231412322',
  })
  @IsNotEmpty({ message: 'IS_NOT_EMPTY' })
  @IsString({ message: 'IS_STRING' })
  phoneNumber: string;

  @ApiProperty({
    description: 'Login password, minimum 8 characters',
    example: 'Admin123!',
    minLength: 8,
  })
  @IsNotEmpty({ message: 'IS_NOT_EMPTY' })
  @IsString({ message: 'IS_STRING' })
  @MinLength(8, { message: 'MIN_LENGTH' })
  password: string;

  @ApiProperty({
    description: 'ID of the admin group this admin will be added to',
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
  })
  @IsNotEmpty({ message: 'IS_NOT_EMPTY' })
  @IsUUID('all', { message: 'IS_UUID' })
  adminGroupId: string;

  @ApiPropertyOptional({
    description: 'Whether the admin account is active',
    example: true,
    default: true,
  })
  @Transform(toBoolean)
  @IsBoolean({ message: 'IS_BOOLEAN' })
  @IsOptional()
  isActive?: boolean;
}

export class UpdateAdminDto {
  @ApiProperty({
    description: 'Full name of the admin',
    example: 'Farhan Taufik Hidayat',
  })
  @IsNotEmpty({ message: 'IS_NOT_EMPTY' })
  @IsString({ message: 'IS_STRING' })
  fullname: string;

  @ApiPropertyOptional({
    description: 'Email address of the admin',
    example: 'farhan@team.superfk.co',
  })
  @IsOptional()
  @IsEmail({}, { message: 'IS_EMAIL' })
  @NormalizeEmail()
  email: string;

  @ApiProperty({
    description: 'Phone number of the admin',
    example: '+6281231412322',
  })
  @IsNotEmpty({ message: 'IS_NOT_EMPTY' })
  @IsString({ message: 'IS_STRING' })
  phoneNumber: string;

  @ApiPropertyOptional({
    description:
      'New login password, minimum 8 characters. Leave empty to keep the current password',
    example: 'Admin123!',
    minLength: 8,
  })
  @IsOptional()
  @IsString({ message: 'IS_STRING' })
  @MinLength(8, { message: 'MIN_LENGTH' })
  password: string;

  @ApiPropertyOptional({
    description:
      'ID of the admin group to move this admin to. Leave empty to keep the current group',
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
  })
  @IsOptional()
  @IsUUID('all', { message: 'IS_UUID' })
  adminGroupId: string;

  @ApiPropertyOptional({
    description: 'Whether the admin account is active',
    example: true,
  })
  @Transform(toBoolean)
  @IsBoolean({ message: 'IS_BOOLEAN' })
  @IsOptional()
  isActive?: boolean;
}
