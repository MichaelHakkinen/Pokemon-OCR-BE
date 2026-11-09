import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { ErrorMessageHelper } from 'src/common/helpers/error-message.helper';
import { AdminAccessService } from 'src/common/auth/admin-access.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { AdminModel } from 'src/models';

type AccessTokenPayload = { sub: string; sid?: string; email?: string };

// Throws instead of writing the response itself, so failures go through the
// global exception filter like every other error.
@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly adminAccess: AdminAccessService,
    private readonly prisma: PrismaService,
    private readonly adminModel: AdminModel,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    const token = this.extractTokenFromHeader(request);
    if (!token) throw this.unauthorized('UNAUTHORIZED');

    let payload: AccessTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<AccessTokenPayload>(token);
    } catch {
      throw this.unauthorized('TOKEN_EXPIRED');
    }

    // Tokens issued before sessions existed carry no sid — reject them.
    if (!payload.sid) throw this.unauthorized('UNAUTHORIZED');

    // The access token is only valid while its own session is: logging out
    // or revoking that session ends it, even before the JWT expires.
    const session = await this.prisma.adminRefreshToken.findFirst({
      where: {
        sessionId: payload.sid,
        adminId: payload.sub,
        isRevoked: false,
        expiresAt: { gt: new Date() },
      },
      select: { id: true },
    });
    if (!session) throw this.unauthorized('UNAUTHORIZED');

    const admin = await this.adminModel.findOne(payload.sub);
    if (!admin) throw this.unauthorized('UNAUTHORIZED');

    request['user'] = {
      ...admin,
      sessionId: payload.sid,
      adminGroupDetail: await this.adminAccess.getGroupDetail(admin.id),
    };
    return true;
  }

  private unauthorized(key: 'UNAUTHORIZED' | 'TOKEN_EXPIRED') {
    return new UnauthorizedException(
      ErrorMessageHelper.getMultiLanguageMessage(key),
    );
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
