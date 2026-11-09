import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ErrorMessageHelper } from 'src/common/helpers/error-message.helper';
import { UNDER_MAINTENANCE_KEY } from './under-maintenance.decorator';
import { MaintenanceService, parsePlatform } from './maintenance.service';

// Global guard: only routes marked @UnderMaintenance() are checked, so admin
// and infrastructure routes (auth, health, docs, files) are never blocked.
@Injectable()
export class MaintenanceGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly maintenance: MaintenanceService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const applies = this.reflector.getAllAndOverride<boolean>(
      UNDER_MAINTENANCE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!applies) return true;

    const request = context.switchToHttp().getRequest();
    const platform = parsePlatform(request.headers?.['x-client-platform']);

    if (await this.maintenance.isBlocked(platform)) {
      throw new ServiceUnavailableException(
        ErrorMessageHelper.getMultiLanguageMessage('APP_UNDER_MAINTENANCE'),
      );
    }
    return true;
  }
}
