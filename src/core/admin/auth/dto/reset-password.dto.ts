import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, MinLength, Matches } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({
    example: 'f9e8d7c6b5a4938271605f4e3d2c1b0a',
    description: 'Reset token obtained from POST /auth/verify-otp. required',
  })
  @IsNotEmpty()
  token: string;

  @ApiProperty({
    example: 'NewAdmin123!',
    description:
      'New password. required | min 8 characters, must contain uppercase, lowercase, number, and special character.',
  })
  @IsNotEmpty()
  @MinLength(8)
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
    {
      message:
        'Password is too weak. It must contain at least 8 characters, one uppercase letter, one lowercase letter, one number, and one special character.',
    },
  )
  password: string;
}
