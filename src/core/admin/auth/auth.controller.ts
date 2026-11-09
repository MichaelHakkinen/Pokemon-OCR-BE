import {
  Body,
  Controller,
  Post,
  Get,
  UseGuards,
  Req,
  UnauthorizedException,
  UseInterceptors,
  UploadedFile,
  HttpStatus,
  BadRequestException,
  HttpCode,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto, LogoutDto } from './dto/refresh-token.dto';
import { AuthService } from './auth.service';
import { AdminAuthGuard } from 'src/guards/AdminAuth.guard';
import { RateLimit } from 'src/common/decorators/rate-limit.decorator';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  defaultMaxFileSize,
  defaultAllowedImageTypeRegex,
  invalidMimesType,
  defaultAllowedImageTypes,
} from 'src/common/config/image.config';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { HelperService } from 'src/utils/helper.service';
import { ErrorMessageHelper } from 'src/common/helpers/error-message.helper';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import {
  ApiCommonErrorResponses,
  ApiSuccessResponse,
} from 'src/common/swagger/response.schemas';
import {
  AdminProfileEntity,
  LoginResponseEntity,
  LogoutResponseEntity,
  MessageResponseEntity,
  OtpVerifiedResponseEntity,
  RefreshTokenResponseEntity,
} from './entities/auth.entity';
import { ResponseMessage } from 'src/common/decorators/response-message.decorator';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private readonly helper: HelperService,
  ) {}

  @Post()
  @RateLimit('admin:login', 5, 300)
  @ApiOperation({
    summary: 'Login',
    description:
      'Authenticates an admin using username and password, returning an access token, refresh token, and RBAC group/module details. Rate limited to 5 attempts per 5 minutes per IP.',
  })
  @ApiSuccessResponse(LoginResponseEntity, {
    status: HttpStatus.OK,
    description: 'Login successful.',
  })
  @ApiCommonErrorResponses({ includeValidation: true })
  @ApiResponse({
    status: HttpStatus.TOO_MANY_REQUESTS,
    description: 'Too many login attempts. Rate limit exceeded.',
  })
  @ResponseMessage('LOGIN_SUCCESS')
  @HttpCode(HttpStatus.OK)
  async login(@Req() req, @Body() data: LoginDto) {
    const login = await this.authService.login(data, req);
    return login;
  }

  @Get('profile')
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Profile',
    description:
      "Returns the currently authenticated admin's profile (password omitted).",
  })
  @ApiSuccessResponse(AdminProfileEntity, {
    status: HttpStatus.OK,
    description: 'Profile retrieved successfully.',
  })
  @ApiCommonErrorResponses()
  @ResponseMessage('DATA_RETRIEVED_SUCCESS')
  async getProfile(@Req() req) {
    const user = req.user;
    if (!user) {
      throw new UnauthorizedException(
        ErrorMessageHelper.getMultiLanguageMessage('UNAUTHORIZED'),
      );
    }

    const data = await this.authService.getProfile(user.id);
    return data;
  }

  @Post('profile')
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update Profile',
    description:
      "Updates the currently authenticated admin's fullname, email, and phone number.",
  })
  @ApiSuccessResponse(AdminProfileEntity, {
    status: HttpStatus.OK,
    description: 'Profile updated successfully.',
  })
  @ApiCommonErrorResponses({ includeValidation: true })
  @ResponseMessage('PROFILE_UPDATED_SUCCESS')
  @HttpCode(HttpStatus.OK)
  async updateProfile(@Req() req, @Body() updateProfileDto: UpdateProfileDto) {
    const user = req.user;
    if (!user) {
      throw new UnauthorizedException(
        ErrorMessageHelper.getMultiLanguageMessage('UNAUTHORIZED'),
      );
    }

    const data = await this.authService.updateProfile(
      user.id,
      updateProfileDto,
      req,
    );

    return data;
  }

  @Post('change-avatar')
  @UseGuards(AdminAuthGuard)
  @UseInterceptors(
    FileInterceptor('avatar', {
      limits: { fileSize: defaultMaxFileSize },
      fileFilter: (req, file, cb) => {
        if (file.mimetype.match(defaultAllowedImageTypeRegex)) {
          cb(null, true);
        } else {
          cb(invalidMimesType(defaultAllowedImageTypes, ['avatar']), false);
        }
      },
    }),
  )
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Change Avatar',
    description:
      'Uploads a new avatar image for the currently authenticated admin, replacing the previous one (allowed image types only).',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    required: true,
    schema: {
      type: 'object',
      required: ['avatar'],
      properties: {
        avatar: {
          type: 'string',
          format: 'binary',
          description: 'Image file to set as the new avatar. required',
        },
      },
    },
  })
  @ApiSuccessResponse(AdminProfileEntity, {
    status: HttpStatus.OK,
    description: 'Avatar updated successfully.',
  })
  @ApiCommonErrorResponses()
  @ResponseMessage('AVATAR_UPDATED_SUCCESS')
  @HttpCode(HttpStatus.OK)
  async changeAvatar(@Req() req, @UploadedFile() avatar: Express.Multer.File) {
    const user = req.user;
    if (!user) {
      throw new UnauthorizedException(
        ErrorMessageHelper.getMultiLanguageMessage('UNAUTHORIZED'),
      );
    }

    if (!avatar) {
      throw new BadRequestException(
        ErrorMessageHelper.getMultiLanguageMessage('IMAGE_REQUIRED'),
      );
    }

    const data = await this.authService.changeAvatar(user.id, avatar, req);

    return data;
  }

  @Post('change-password')
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Change Password',
    description:
      "Changes the currently authenticated admin's password after verifying the old password and confirming the new password.",
  })
  @ApiSuccessResponse(MessageResponseEntity, {
    status: HttpStatus.OK,
    description: 'Password changed successfully.',
  })
  @ApiCommonErrorResponses({ includeValidation: true })
  @ResponseMessage('PASSWORD_CHANGED_SUCCESS')
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @Req() req,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    const user = req.user;
    if (!user) {
      throw new UnauthorizedException(
        ErrorMessageHelper.getMultiLanguageMessage('UNAUTHORIZED'),
      );
    }

    const data = await this.authService.changePassword(
      user.id,
      changePasswordDto,
      req,
    );

    return data;
  }

  @Post('refresh-token')
  @ApiOperation({
    summary: 'Refresh Token',
    description:
      'Exchanges a valid, non-expired refresh token for a new access token and a new refresh token. The old refresh token is revoked.',
  })
  @ApiSuccessResponse(RefreshTokenResponseEntity, {
    status: HttpStatus.OK,
    description: 'Token refreshed successfully.',
  })
  @ApiCommonErrorResponses({ includeValidation: true })
  @ResponseMessage('TOKEN_REFRESHED_SUCCESS')
  @HttpCode(HttpStatus.OK)
  async refreshToken(@Req() req, @Body() refreshTokenDto: RefreshTokenDto) {
    const data = await this.authService.refreshToken(
      refreshTokenDto.refreshToken,
    );
    return data;
  }

  @Post('forgot-password')
  @RateLimit('admin:forgot-password', 3, 300)
  @ApiOperation({
    summary: 'Forgot Password',
    description:
      'Sends a numeric OTP (length set by OTP_LENGTH) to the admin email if it is registered, replacing any earlier OTP. Always responds successfully to avoid email enumeration. Rate limited to 3 requests per 5 minutes per IP, with an additional resend delay enforced between OTP requests.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'OTP sent successfully (or email not found, silently).',
    schema: {
      properties: {
        code: { type: 'number', example: HttpStatus.OK },
        status: { type: 'string', example: 'success' },
        message: { type: 'string', example: 'OTP sent successfully' },
        data: { type: 'boolean', example: true },
      },
    },
  })
  @ApiCommonErrorResponses({ includeValidation: true })
  @ResponseMessage('OTP_SENT_SUCCESS')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Req() req, @Body() data: ForgotPasswordDto) {
    const result = await this.authService.forgotPassword(data);
    return result;
  }

  @Post('verify-otp')
  @RateLimit('admin:verify-otp', 10, 300)
  @ApiOperation({
    summary: 'Forgot Password - Verify OTP',
    description:
      'Validates the OTP sent to the admin email and returns a short-lived reset token to use with POST /auth/reset-password. Each OTP is invalidated after OTP_MAX_ATTEMPTS wrong guesses. Rate limited to 10 attempts per 5 minutes per IP.',
  })
  @ApiSuccessResponse(OtpVerifiedResponseEntity, {
    status: HttpStatus.OK,
    description: 'OTP verified successfully.',
  })
  @ApiCommonErrorResponses({ includeValidation: true })
  @ResponseMessage('OTP_VERIFIED_SUCCESS')
  @HttpCode(HttpStatus.OK)
  async verifyOtp(@Req() req, @Body() data: VerifyOtpDto) {
    const result = await this.authService.verifyOtp(data);
    return result;
  }

  @Post('reset-password')
  @RateLimit('admin:reset-password', 5, 300)
  @ApiOperation({
    summary: 'Reset Password',
    description:
      'Sets a new password using the reset token obtained from POST /auth/verify-otp. Rate limited to 5 attempts per 5 minutes per IP.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Password reset successfully.',
    schema: {
      properties: {
        code: { type: 'number', example: HttpStatus.OK },
        status: { type: 'string', example: 'success' },
        message: { type: 'string', example: 'Password reset successfully' },
        data: { type: 'boolean', example: true },
      },
    },
  })
  @ApiCommonErrorResponses({ includeValidation: true })
  @ResponseMessage('PASSWORD_RESET_SUCCESS')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Req() req, @Body() data: ResetPasswordDto) {
    const result = await this.authService.resetPassword(data);
    return result;
  }

  @Post('logout')
  @ApiOperation({
    summary: 'Logout',
    description:
      'Ends the session the given refresh token belongs to: the refresh token and the access tokens issued for that session stop working.',
  })
  @ApiSuccessResponse(LogoutResponseEntity, {
    status: HttpStatus.OK,
    description: 'Logout successful.',
  })
  @ApiCommonErrorResponses({ includeValidation: true })
  @ResponseMessage('LOGOUT_SUCCESS')
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req, @Body() logoutDto: LogoutDto) {
    const data = await this.authService.logout(logoutDto.refreshToken);
    return data;
  }
}
