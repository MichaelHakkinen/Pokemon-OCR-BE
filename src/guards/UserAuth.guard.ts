import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { ErrorMessageHelper } from 'src/common/helpers/error-message.helper';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserModel } from 'src/models';

type AccessTokenPayload = { sub: string; sid?: string; email?: string };

// Same contract as AdminAuthGuard: the access token must carry the `sid` of a
// live user session, and failures are thrown for the global exception filter.
@Injectable()
export class UserAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly userModel: UserModel,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    const token = this.extractTokenFromHeader(request);
    if (!token) {
      throw new UnauthorizedException(
        ErrorMessageHelper.getMultiLanguageMessage('UNAUTHORIZED'),
      );
    }

    let payload: AccessTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<AccessTokenPayload>(token);
    } catch {
      throw this.tokenExpired();
    }

    if (!payload.sid) throw this.tokenExpired();

    const session = await this.prisma.userRefreshToken.findFirst({
      where: {
        sessionId: payload.sid,
        userId: payload.sub,
        isRevoked: false,
        expiresAt: { gt: new Date() },
      },
      select: { id: true },
    });
    if (!session) throw this.tokenExpired();

    const user = await this.userModel.findOne(payload.sub);
    if (!user) {
      throw new UnauthorizedException(
        ErrorMessageHelper.getMultiLanguageMessage('UNAUTHORIZED'),
      );
    }

    request['user'] = { ...user, sessionId: payload.sid };
    return true;
  }

  private tokenExpired() {
    return new UnauthorizedException({
      errorCode: 'TOKEN_EXPIRED',
      ...ErrorMessageHelper.getMultiLanguageMessage('TOKEN_EXPIRED'),
    });
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
