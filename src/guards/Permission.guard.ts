import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { HelperService } from 'src/utils/helper.service';
import {
  MODULE_NAME_KEY,
  RULE_NAME_KEY,
} from 'src/common/decorators/permission.decorator';

// Composable replacement for the old pattern of every controller method
// manually calling helperService.checkAuthorization(). Routes without a
// @RequireRule() decorator are left unrestricted (same as before, where
// calling checkAuthorization() was opt-in per method).
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly helperService: HelperService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const ruleName = this.reflector.get<string>(
      RULE_NAME_KEY,
      context.getHandler(),
    );
    if (!ruleName) return true;

    const moduleName = this.reflector.get<string>(
      MODULE_NAME_KEY,
      context.getClass(),
    );
    const request = context.switchToHttp().getRequest();

    return this.helperService.checkAuthorization(
      request.user?.adminGroupDetail,
      moduleName,
      ruleName,
    );
  }
}
