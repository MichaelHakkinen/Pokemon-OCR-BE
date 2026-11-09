import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({
    example: 'b6e2c1d0f4a5...9f8e7d6c5b4a3928',
    description:
      'Refresh token previously issued at login, used to obtain a new access token. required',
  })
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}

export class LogoutDto {
  @ApiProperty({
    example: 'b6e2c1d0f4a5...9f8e7d6c5b4a3928',
    description: 'Refresh token to revoke on logout. required',
  })
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}

export interface RefreshTokenResponse {
  code: number;
  token: string;
  refreshToken: string;
  user: {
    id: string;
    fullname: string;
    email: string;
    avatar: string | null;
  };
  adminGroupDetail: {
    groups: Array<{
      id: string;
      name: string;
    }>;
    modules: any[];
  };
}

export interface LogoutResponse {
  code: number;
  message: string;
}
