import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { toBoolean } from 'src/common/helpers/transform.helper';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NormalizeEmail } from 'src/common/helpers/email.helper';

export class CreateUserDto {
  @ApiProperty({
    description: 'Full name of the user',
    example: 'John Doe',
  })
  @IsNotEmpty({ message: 'IS_NOT_EMPTY' })
  @IsString({ message: 'IS_STRING' })
  fullname: string;

  @ApiPropertyOptional({
    description: 'Email address of the user',
    example: 'johndoe@example.com',
  })
  @IsOptional()
  @IsEmail({}, { message: 'IS_EMAIL' })
  @NormalizeEmail()
  email: string;

  @ApiProperty({
    description: 'Unique username used for login (minimum 4 characters)',
    example: 'johndoe',
    minLength: 4,
  })
  @IsNotEmpty({ message: 'IS_NOT_EMPTY' })
  @IsString({ message: 'IS_STRING' })
  @MinLength(4, { message: 'MIN_LENGTH' })
  username: string;

  @ApiProperty({
    description: 'Phone number of the user',
    example: '081234567890',
  })
  @IsNotEmpty({ message: 'IS_NOT_EMPTY' })
  @IsString({ message: 'IS_STRING' })
  phoneNumber: string;

  @ApiProperty({
    description: 'Password for the user account (minimum 8 characters)',
    example: 'User1234!',
    minLength: 8,
  })
  @IsNotEmpty({ message: 'IS_NOT_EMPTY' })
  @IsString({ message: 'IS_STRING' })
  @MinLength(8, { message: 'MIN_LENGTH' })
  password: string;

  @ApiPropertyOptional({
    description: 'Whether the user account is active',
    example: true,
    default: true,
  })
  @Transform(toBoolean)
  @IsBoolean({ message: 'IS_BOOLEAN' })
  @IsOptional()
  isActive?: boolean;
}

export class UpdateUserDto {
  @ApiProperty({
    description: 'Full name of the user',
    example: 'John Doe',
  })
  @IsNotEmpty({ message: 'IS_NOT_EMPTY' })
  @IsString({ message: 'IS_STRING' })
  fullname: string;

  @ApiPropertyOptional({
    description: 'Email address of the user',
    example: 'johndoe@example.com',
  })
  @IsOptional()
  @IsEmail({}, { message: 'IS_EMAIL' })
  @NormalizeEmail()
  email: string;

  @ApiProperty({
    description: 'Phone number of the user',
    example: '081234567890',
  })
  @IsNotEmpty({ message: 'IS_NOT_EMPTY' })
  @IsString({ message: 'IS_STRING' })
  phoneNumber: string;

  @ApiPropertyOptional({
    description:
      'New password for the user account (minimum 8 characters). Leave empty to keep the current password',
    example: 'User1234!',
    minLength: 8,
  })
  @IsOptional()
  @IsString({ message: 'IS_STRING' })
  @MinLength(8, { message: 'MIN_LENGTH' })
  password: string;

  @ApiPropertyOptional({
    description: 'Whether the user account is active',
    example: true,
  })
  @Transform(toBoolean)
  @IsBoolean({ message: 'IS_BOOLEAN' })
  @IsOptional()
  isActive?: boolean;
}
