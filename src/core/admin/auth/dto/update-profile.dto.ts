import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsEmail } from 'class-validator';
import { NormalizeEmail } from 'src/common/helpers/email.helper';

export class UpdateProfileDto {
  @ApiProperty({
    example: 'Super Admin',
    description: "Admin's full name. required",
  })
  @IsNotEmpty({ message: 'IS_NOT_EMPTY' })
  @IsString({ message: 'IS_STRING' })
  fullname: string;

  @ApiPropertyOptional({
    example: 'admin@superfk.co',
    description: "Admin's email address. optional | email",
  })
  @IsOptional()
  @IsEmail({}, { message: 'IS_EMAIL' })
  @NormalizeEmail()
  email: string;

  @ApiProperty({
    example: '081234567890',
    description: "Admin's phone number. required",
  })
  @IsNotEmpty({ message: 'IS_NOT_EMPTY' })
  @IsString({ message: 'IS_STRING' })
  phoneNumber: string;
}
