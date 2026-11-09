import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isUUID } from 'class-validator';
import { UserAuthGuard } from 'src/guards/UserAuth.guard';
import { PrismaService } from 'src/prisma/prisma.service';

/**
 * Protects collection routes with the normal user JWT (UserAuthGuard).
 *
 * Dev-only escape hatch: while the mobile app has no login screen, setting
 * DEV_USER_HEADER_AUTH=true (and NODE_ENV != production) lets a request act as
 * an existing user by sending `x-user-id: <uuid>`. Never enable it in production.
 */
@Injectable()
export class CollectionUserGuard implements CanActivate {
  private readonly logger = new Logger(CollectionUserGuard.name);
  private readonly devHeaderAuth: boolean;

  constructor(
    private readonly userAuthGuard: UserAuthGuard,
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    const isProd = config.get<string>('NODE_ENV') === 'production';
    this.devHeaderAuth =
      !isProd && config.get<string>('DEV_USER_HEADER_AUTH') === 'true';
    if (this.devHeaderAuth) {
      this.logger.warn(
        'DEV_USER_HEADER_AUTH is on: collection routes accept x-user-id without a token.',
      );
    }
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const headerUserId = request.headers['x-user-id'];
    const hasBearer = !!request.headers.authorization;

    if (this.devHeaderAuth && !hasBearer && typeof headerUserId === 'string') {
      if (!isUUID(headerUserId)) {
        throw new UnauthorizedException('x-user-id must be a UUID');
      }
      const user = await this.prisma.user.findFirst({
        where: { id: headerUserId, deletedAt: null, isActive: true },
        select: { id: true },
      });
      if (!user) {
        throw new UnauthorizedException('Unknown x-user-id');
      }
      request['user'] = { id: user.id };
      return true;
    }

    return this.userAuthGuard.canActivate(context);
  }
}
