import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumberString, ValidateBy } from 'class-validator';
import { getOtpLength } from 'src/common/helpers/token.helper';
import { NormalizeEmail } from 'src/common/helpers/email.helper';

// Length is checked at validation time (not decoration time) so it always
// follows OTP_LENGTH, which ConfigModule only loads after this file is imported.
const HasOtpLength = () =>
  ValidateBy({
    name: 'hasOtpLength',
    validator: {
      validate: (value: unknown) =>
        typeof value === 'string' && value.length === getOtpLength(),
      defaultMessage: () => `otp must be exactly ${getOtpLength()} digits`,
    },
  });

export class VerifyOtpDto {
  @ApiProperty({
    example: '123456',
    description:
      'Numeric OTP sent to the admin email; its length is set by OTP_LENGTH (default 6). required',
  })
  @IsNotEmpty()
  @IsNumberString({ no_symbols: true })
  @HasOtpLength()
  otp: string;

  @ApiProperty({
    example: 'admin@superfk.co',
    description: 'Email the OTP was sent to. required',
  })
  @IsNotEmpty()
  @NormalizeEmail()
  email: string;
}
