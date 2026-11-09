import {
  Injectable,
  UnprocessableEntityException,
  BadRequestException,
  UnauthorizedException,
  Logger,
  OnModuleDestroy,
} from '@nestjs/common';
import { LoginDto } from './dto/login.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { RefreshTokenResponse } from './dto/refresh-token.dto';
import { AdminResponse } from 'src/models';
import { JwtService } from '@nestjs/jwt';
import { HelperService } from 'src/utils/helper.service';
import * as bcrypt from 'bcrypt';
import { ErrorMessageHelper } from 'src/common/helpers/error-message.helper';
import { StorageService } from 'src/common/services/storage.service';
import { LogActions } from 'src/common/constants/log-actions';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { MailRelayService } from 'src/mail-relay/mail-relay.service';
import { RedisService } from 'src/common/services/redis.service';
import { AdminAccessService } from 'src/common/auth/admin-access.service';
import { ConfigService } from '@nestjs/config';
import { SignOptions } from 'jsonwebtoken';
import { AppConfig } from 'src/common/config/env.validation';
import {
  durationToMs,
  generateOtp,
  generateToken,
  hashSecret,
  secretMatchesHash,
} from 'src/common/helpers/token.helper';
import { PrismaService } from 'src/prisma/prisma.service';
import { AdminModel } from 'src/models';
import { assertEmailAvailable } from 'src/common/helpers/email.helper';

// bcrypt hash (cost 10, same as real password hashes) of a random value no
// one knows, compared against when a username doesn't exist. Computed once.
const DUMMY_PASSWORD_HASH = bcrypt.hashSync(generateToken(16), 10);

@Injectable()
export class AuthService implements OnModuleDestroy {
  private readonly logger = new Logger(AuthService.name);
  private readonly backgroundTasks = new Set<Promise<void>>();

  constructor(
    private jwtService: JwtService,
    private readonly helperService: HelperService,
    private readonly storageService: StorageService,
    private readonly mailService: MailRelayService,
    private readonly adminAccess: AdminAccessService,
    private readonly prisma: PrismaService,
    private readonly adminModel: AdminModel,
    private readonly redis: RedisService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  private getRefreshTokenExpiration(): Date {
    return new Date(
      Date.now() +
        durationToMs(this.config.get('REFRESH_TOKEN_EXPIRATION_TIME')),
    );
  }

  // Issues a refresh token for a session. A new login starts a new session;
  // rotation passes the existing sessionId so the session id stays stable.
  // Only the hash is persisted — the raw token goes back to the client once.
  private async issueRefreshToken(
    adminId: string,
    sessionId?: string,
  ): Promise<{ refreshToken: string; sessionId: string }> {
    const refreshToken = generateToken();
    const row = await this.prisma.adminRefreshToken.create({
      data: {
        adminId,
        token: hashSecret(refreshToken),
        expiresAt: this.getRefreshTokenExpiration(),
        ...(sessionId ? { sessionId } : {}),
      },
      select: { sessionId: true },
    });
    return { refreshToken, sessionId: row.sessionId };
  }

  private signAccessToken(
    admin: { id: string; email: string | null },
    sessionId: string,
  ): Promise<string> {
    return this.jwtService.signAsync(
      { email: admin.email, sub: admin.id, sid: sessionId },
      {
        expiresIn: this.config.get(
          'JWT_EXPIRATION_TIME',
        ) as SignOptions['expiresIn'],
        secret: this.config.get('JWT_SECRET_KEY'),
      },
    );
  }

  // Revoked rows are kept until they expire so a replayed (stolen) refresh
  // token can still be recognised — only expired rows are deleted.
  private async cleanupExpiredTokens(adminId: string): Promise<void> {
    await this.prisma.adminRefreshToken.deleteMany({
      where: { adminId, expiresAt: { lt: new Date() } },
    });
  }

  private async revokeSession(sessionId: string): Promise<void> {
    await this.prisma.adminRefreshToken.updateMany({
      where: { sessionId, isRevoked: false },
      data: { isRevoked: true },
    });
  }

  async login(data: LoginDto, request?: any): Promise<any> {
    const user = await this.adminModel.findByUsername(data.username);

    // Always run one bcrypt comparison — against a dummy hash when the user
    // doesn't exist — so response time doesn't reveal valid usernames.
    const passwordMatches = await this.helperService.comparePassword(
      data.password,
      user?.password ?? DUMMY_PASSWORD_HASH,
    );
    if (!user || !passwordMatches) {
      throw new UnprocessableEntityException(
        ErrorMessageHelper.getMultiLanguageMessage('INVALID_CREDENTIALS'),
      );
    }

    await this.cleanupExpiredTokens(user.id);

    const { refreshToken, sessionId } = await this.issueRefreshToken(user.id);
    const token = await this.signAccessToken(user, sessionId);

    const adminGroupDetail = await this.adminAccess.getGroupDetail(user.id);

    const result = {
      token,
      refreshToken,
      user: {
        id: user.id,
        fullname: user.fullname,
        email: user.email,
        avatar: user.avatar
          ? this.helperService.generateFileUrl(user.avatar)
          : null,
      },
      adminGroupDetail,
    };

    // Log successful login
    if (request) {
      await this.helperService.logAction(LogActions.LOGIN, {
        adminId: user.id,
        request,
        targetId: user.id,
        notes: `Login successful - ${user.fullname}`,
      });
    }

    return result;
  }

  async getProfile(id: string): Promise<Omit<AdminResponse, 'password'>> {
    // get data
    const admin = await this.adminModel.findOne(id);

    if (!admin) {
      throw new BadRequestException(
        ErrorMessageHelper.getMultiLanguageMessage('ADMIN_NOT_FOUND'),
      );
    }

    // normalize data
    const data = {
      ...admin,
      avatar: admin.avatar
        ? this.helperService.generateFileUrl(admin.avatar)
        : null,
      password: undefined,
    };

    return data;
  }

  async updateProfile(
    userId: string,
    updateProfileDto: UpdateProfileDto,
    request?: any,
  ): Promise<any> {
    // Get current admin
    const admin = await this.adminModel.findOne(userId);
    if (!admin) {
      throw new BadRequestException(
        ErrorMessageHelper.getMultiLanguageMessage('ADMIN_NOT_FOUND'),
      );
    }

    await assertEmailAvailable(
      this.prisma.admin,
      updateProfileDto.email,
      userId,
    );

    // Update admin profile
    const transaction = await this.prisma.$transaction(async (tx) => {
      // Get current data
      const adminData = await tx.admin.findFirst({
        where: {
          id: userId,
          deletedAt: null,
        },
      });

      if (!adminData) {
        throw new BadRequestException(
          ErrorMessageHelper.getMultiLanguageMessage('ADMIN_NOT_FOUND'),
        );
      }

      // Update the admin
      const admin = await tx.admin.update({
        where: { id: userId },
        data: {
          fullname: updateProfileDto.fullname ?? adminData.fullname,
          email: updateProfileDto.email ?? adminData.email,
          phoneNumber: updateProfileDto.phoneNumber ?? adminData.phoneNumber,
          updatedAt: new Date(),
        },
      });

      // normalize data
      const data = {
        ...admin,
        avatar: admin.avatar
          ? this.helperService.generateFileUrl(admin.avatar)
          : null,
        password: undefined,
      };

      return data;
    });

    // Log profile update
    if (request) {
      await this.helperService.logAction(LogActions.EDIT_PROFILE, {
        adminId: userId,
        request,
        targetId: userId,
        notes: 'Profile updated',
        valueBefore: admin,
        valueAfter: transaction,
      });
    }

    return transaction;
  }

  async changeAvatar(
    userId: string,
    avatar?: Express.Multer.File,
    request?: any,
  ): Promise<any> {
    // Get current admin
    const admin = await this.adminModel.findOne(userId);
    if (!admin) {
      throw new BadRequestException(
        ErrorMessageHelper.getMultiLanguageMessage('ADMIN_NOT_FOUND'),
      );
    }

    if (!avatar) {
      throw new BadRequestException(
        ErrorMessageHelper.getMultiLanguageMessage('IMAGE_REQUIRED'),
      );
    }

    // Update avatar in transaction
    const transaction = await this.storageService.withUpload(
      {
        file: avatar,
        options: {
          folder: 'avatar-admin',
          prefix: 'admin',
          identifier: admin.fullname,
        },
        replaces: admin.avatar,
      },
      // new avatar uploaded first; the old one is deleted only after
      // the update commits, and the new one removed if it fails
      (avatarUrl) =>
        this.prisma.$transaction(async (tx) => {
          // Get current data
          const adminData = await tx.admin.findFirst({
            where: {
              id: userId,
              deletedAt: null,
            },
          });

          if (!adminData) {
            throw new BadRequestException(
              ErrorMessageHelper.getMultiLanguageMessage('ADMIN_NOT_FOUND'),
            );
          }

          // Update the admin avatar
          const admin = await tx.admin.update({
            where: { id: userId },
            data: {
              avatar: avatarUrl,
              updatedAt: new Date(),
            },
          });

          // normalize data
          const data = {
            ...admin,
            avatar: admin.avatar
              ? this.helperService.generateFileUrl(admin.avatar)
              : null,
            password: undefined,
          };

          return data;
        }),
    );

    // Log avatar change
    if (request) {
      await this.helperService.logAction(LogActions.EDIT_PROFILE, {
        adminId: userId,
        request,
        targetId: userId,
        notes: 'Avatar updated',
        valueBefore: admin,
        valueAfter: transaction,
      });
    }

    return transaction;
  }

  async changePassword(
    userId: string,
    changePasswordDto: ChangePasswordDto,
    request?: any,
  ): Promise<any> {
    // Get current admin with password
    const admin = await this.prisma.admin.findFirst({
      where: { id: userId, deletedAt: null },
      select: {
        id: true,
        password: true,
      },
    });

    if (!admin) {
      throw new BadRequestException(
        ErrorMessageHelper.getMultiLanguageMessage('ADMIN_NOT_FOUND'),
      );
    }

    // Verify old password
    const isOldPasswordValid = await this.helperService.comparePassword(
      changePasswordDto.oldPassword,
      admin.password,
    );

    if (!isOldPasswordValid) {
      throw new UnprocessableEntityException(
        ErrorMessageHelper.getMultiLanguageMessage('OLD_PASSWORD_INCORRECT'),
      );
    }

    // Check if new password and confirm password match
    if (
      changePasswordDto.newPassword !== changePasswordDto.confirmNewPassword
    ) {
      throw new UnprocessableEntityException(
        ErrorMessageHelper.getMultiLanguageMessage('PASSWORD_DO_NOT_MATCH'),
      );
    }

    // Validate new password meets criteria
    const isValid = await this.helperService.validatePassword(
      changePasswordDto.newPassword,
    );
    if (!isValid) {
      throw new UnprocessableEntityException(
        ErrorMessageHelper.getMultiLanguageMessage('PASSWORD_CRITERIA_NOT_MET'),
      );
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(changePasswordDto.newPassword, 10);

    // Update password and sign out every other session in one transaction;
    // the session making this request stays signed in.
    const currentSessionId: string | undefined = request?.user?.sessionId;
    const transaction = await this.prisma.$transaction(async (tx) => {
      await tx.admin.update({
        where: { id: userId },
        data: {
          password: hashedPassword,
          updatedAt: new Date(),
        },
      });

      await tx.adminRefreshToken.updateMany({
        where: {
          adminId: userId,
          isRevoked: false,
          ...(currentSessionId ? { sessionId: { not: currentSessionId } } : {}),
        },
        data: { isRevoked: true },
      });

      return {
        message: 'Password changed successfully',
      };
    });

    // Log password change
    if (request) {
      await this.helperService.logAction(LogActions.EDIT_PROFILE, {
        adminId: userId,
        request,
        targetId: userId,
        notes: 'Password changed',
        // never put the password hash into the audit log
        valueBefore: { id: admin.id },
        valueAfter: transaction,
      });
    }

    return transaction;
  }

  async refreshToken(refreshToken: string): Promise<RefreshTokenResponse> {
    const stored = await this.prisma.adminRefreshToken.findUnique({
      where: { token: hashSecret(refreshToken.trim()) },
      include: { admin: true },
    });

    if (!stored) {
      throw new UnauthorizedException(
        ErrorMessageHelper.getMultiLanguageMessage('UNAUTHORIZED'),
      );
    }

    // A revoked token being presented again means it was copied — either the
    // client or an attacker is replaying an old token. Kill the whole session
    // so the stolen chain stops working for both parties.
    if (stored.isRevoked) {
      await this.revokeSession(stored.sessionId);
      throw new UnauthorizedException(
        ErrorMessageHelper.getMultiLanguageMessage('UNAUTHORIZED'),
      );
    }

    if (stored.expiresAt < new Date()) {
      throw new UnauthorizedException(
        ErrorMessageHelper.getMultiLanguageMessage('TOKEN_EXPIRED'),
      );
    }

    const admin = stored.admin;

    if (!admin.isActive || admin.deletedAt) {
      await this.revokeSession(stored.sessionId);
      throw new UnprocessableEntityException(
        ErrorMessageHelper.getMultiLanguageMessage('ACCOUNT_INACTIVE'),
      );
    }

    // Conditional update so two concurrent refreshes with the same token
    // can't both succeed — the loser is treated as a replay.
    const { count } = await this.prisma.adminRefreshToken.updateMany({
      where: { id: stored.id, isRevoked: false },
      data: { isRevoked: true },
    });
    if (count === 0) {
      await this.revokeSession(stored.sessionId);
      throw new UnauthorizedException(
        ErrorMessageHelper.getMultiLanguageMessage('UNAUTHORIZED'),
      );
    }

    const { refreshToken: newRefreshToken } = await this.issueRefreshToken(
      admin.id,
      stored.sessionId,
    );
    const newToken = await this.signAccessToken(admin, stored.sessionId);

    const adminGroupDetail = await this.adminAccess.getGroupDetail(admin.id);

    return {
      code: 200,
      token: newToken,
      refreshToken: newRefreshToken,
      user: {
        id: admin.id,
        fullname: admin.fullname,
        email: admin.email,
        avatar: admin.avatar
          ? this.helperService.generateFileUrl(admin.avatar)
          : null,
      },
      adminGroupDetail,
    };
  }

  // Responds the same way for registered and unknown emails, so the endpoint
  // can't be used to discover accounts: same resend-delay rule for every
  // address, and the OTP is stored and emailed in the background so neither
  // response time nor email failures depend on whether the account exists.
  async forgotPassword(data: ForgotPasswordDto): Promise<boolean> {
    const email = data.email.trim().toLowerCase();

    // Resend delay keyed by the (hashed) address, applied whether or not an
    // account exists. incr is atomic, so concurrent requests can't both pass.
    const resendKey = `otp_resend:${hashSecret(email)}`;
    const attempts = await this.redis.incr(resendKey);
    if (attempts === 1) {
      await this.redis.expire(
        resendKey,
        this.config.get('OTP_RESEND_DELAY_SECONDS'),
      );
    } else {
      throw new BadRequestException(
        ErrorMessageHelper.getMultiLanguageMessage('OTP_RESEND_DELAY'),
      );
    }

    const admin = await this.adminModel.findByEmail(data.email);
    if (admin) {
      this.runInBackground(this.issueResetOtp(admin), 'send reset OTP');
    }
    return true;
  }

  private async issueResetOtp(admin: {
    id: string;
    email: string;
    fullname: string;
  }): Promise<void> {
    const otp = generateOtp(this.config.get('OTP_LENGTH'));
    const now = new Date();
    const otpExpiresAt = new Date(
      now.getTime() + this.config.get('OTP_EXPIRE_MINUTES') * 60_000,
    );

    // Only one OTP may be live per admin: issuing a new one retires the rest,
    // otherwise each resend would add another valid code to guess against.
    await this.prisma.$transaction([
      this.prisma.adminResetPassword.updateMany({
        where: { adminId: admin.id, deletedAt: null },
        data: { deletedAt: now },
      }),
      this.prisma.adminResetPassword.create({
        data: {
          adminId: admin.id,
          otp: hashSecret(otp),
          otpExpiresAt,
          lastOtpSentAt: now,
          createdAt: now,
          updatedAt: now,
        },
      }),
    ]);

    await this.mailService.sendForgotPasswordOtp({
      to: admin.email,
      otp,
      fullname: admin.fullname,
      expireMinutes: String(this.config.get('OTP_EXPIRE_MINUTES')),
    });
  }

  // Fire-and-forget with error logging. Tracked so shutdown can wait for
  // in-flight work instead of dropping an OTP email mid-send.
  private runInBackground(task: Promise<void>, label: string): void {
    const tracked = task
      .catch((err: Error) =>
        this.logger.error(`Failed to ${label}: ${err.message}`, err.stack),
      )
      .finally(() => this.backgroundTasks.delete(tracked));
    this.backgroundTasks.add(tracked);
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.allSettled([...this.backgroundTasks]);
  }

  async verifyOtp(data: VerifyOtpDto): Promise<{ token: string }> {
    const admin = await this.adminModel.findByEmail(data.email);
    if (!admin) {
      throw new BadRequestException(
        ErrorMessageHelper.getMultiLanguageMessage('INCORRECT_OTP'),
      );
    }

    const resetRequest = await this.prisma.adminResetPassword.findFirst({
      where: {
        adminId: admin.id,
        deletedAt: null,
        otpVerifiedAt: null,
        otpExpiresAt: { gt: new Date() },
      },
      orderBy: { lastOtpSentAt: 'desc' },
    });

    if (!resetRequest) {
      throw new BadRequestException(
        ErrorMessageHelper.getMultiLanguageMessage('INCORRECT_OTP'),
      );
    }

    // Reserve the attempt before comparing, atomically, so parallel guesses
    // can't slip past the limit by all reading the same counter.
    const maxAttempts = this.config.get('OTP_MAX_ATTEMPTS');
    const { count } = await this.prisma.adminResetPassword.updateMany({
      where: { id: resetRequest.id, failedAttempts: { lt: maxAttempts } },
      data: { failedAttempts: { increment: 1 } },
    });

    if (count === 0) {
      await this.prisma.adminResetPassword.update({
        where: { id: resetRequest.id },
        data: { deletedAt: new Date() },
      });
      throw new BadRequestException(
        ErrorMessageHelper.getMultiLanguageMessage('OTP_ATTEMPTS_EXCEEDED'),
      );
    }

    if (!secretMatchesHash(data.otp, resetRequest.otp)) {
      throw new BadRequestException(
        ErrorMessageHelper.getMultiLanguageMessage('INCORRECT_OTP'),
      );
    }

    const resetToken = generateToken(32);
    await this.prisma.adminResetPassword.update({
      where: { id: resetRequest.id },
      data: {
        otpVerifiedAt: new Date(),
        resetToken: hashSecret(resetToken),
        resetTokenExpiresAt: new Date(Date.now() + 15 * 60_000), // 15 minutes
      },
    });

    return { token: resetToken };
  }

  async resetPassword(data: ResetPasswordDto): Promise<boolean> {
    const resetRequest = await this.prisma.adminResetPassword.findFirst({
      where: {
        resetToken: hashSecret(data.token),
        deletedAt: null,
        otpVerifiedAt: { not: null },
        resetTokenExpiresAt: { gt: new Date() },
      },
      include: { admin: true },
    });

    if (!resetRequest || !resetRequest.admin) {
      throw new BadRequestException(
        ErrorMessageHelper.getMultiLanguageMessage('OTP_EXPIRED'),
      );
    }

    const isValid = await this.helperService.validatePassword(data.password);
    if (!isValid) {
      throw new BadRequestException(
        ErrorMessageHelper.getMultiLanguageMessage('PASSWORD_CRITERIA_NOT_MET'),
      );
    }

    // Update password, consume the reset request, and sign out every session:
    // a reset usually means the old password (and its sessions) can't be trusted.
    await this.prisma.$transaction([
      this.prisma.admin.update({
        where: { id: resetRequest.admin.id },
        data: {
          password: await bcrypt.hash(data.password, 10),
          updatedAt: new Date(),
        },
      }),
      this.prisma.adminResetPassword.update({
        where: { id: resetRequest.id },
        data: { deletedAt: new Date() },
      }),
      this.prisma.adminRefreshToken.updateMany({
        where: { adminId: resetRequest.admin.id, isRevoked: false },
        data: { isRevoked: true },
      }),
    ]);

    return true;
  }

  async logout(
    refreshToken: string,
  ): Promise<{ code: number; message: string }> {
    const stored = await this.prisma.adminRefreshToken.findUnique({
      where: { token: hashSecret(refreshToken.trim()) },
      select: { sessionId: true },
    });

    // Ending the session (not just this token) also invalidates the access
    // token issued alongside it, since the guard checks the session id.
    if (stored) {
      await this.revokeSession(stored.sessionId);
    }

    return {
      code: 200,
      message: 'Logout successful',
    };
  }

  async revokeAllUserTokens(
    adminId: string,
    exceptSessionId?: string,
  ): Promise<void> {
    await this.prisma.adminRefreshToken.updateMany({
      where: {
        adminId,
        isRevoked: false,
        ...(exceptSessionId ? { sessionId: { not: exceptSessionId } } : {}),
      },
      data: { isRevoked: true },
    });
  }
}
