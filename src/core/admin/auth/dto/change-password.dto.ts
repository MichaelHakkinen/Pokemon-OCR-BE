import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({
    example: 'Admin123!',
    description: "Admin's current password. required",
  })
  @IsNotEmpty({ message: 'IS_NOT_EMPTY' })
  @IsString({ message: 'IS_STRING' })
  oldPassword: string;

  @ApiProperty({
    example: 'NewAdmin123!',
    description: 'New password. required | min 8 characters',
  })
  @IsNotEmpty({ message: 'IS_NOT_EMPTY' })
  @IsString({ message: 'IS_STRING' })
  @MinLength(8, { message: 'MIN_LENGTH' })
  newPassword: string;

  @ApiProperty({
    example: 'NewAdmin123!',
    description: 'Must match newPassword. required',
  })
  @IsNotEmpty({ message: 'IS_NOT_EMPTY' })
  @IsString({ message: 'IS_STRING' })
  confirmNewPassword: string;
}
