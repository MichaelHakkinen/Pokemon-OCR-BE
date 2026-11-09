import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty } from 'class-validator';
import { NormalizeEmail } from 'src/common/helpers/email.helper';

export class ForgotPasswordDto {
  @ApiProperty({
    example: 'admin@superfk.co',
    description:
      'Registered admin email that will receive the OTP. required | email',
  })
  @IsEmail()
  @IsNotEmpty()
  @NormalizeEmail()
  email: string;
}
