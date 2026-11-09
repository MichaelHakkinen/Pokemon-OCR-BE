import { SetMetadata } from '@nestjs/common';

export const MODULE_NAME_KEY = 'module_name';
export const RULE_NAME_KEY = 'rule_name';

// Class-level: names the module this controller's routes belong to,
// matching the Module.name row used for RBAC lookups.
export const RequireModule = (moduleName: string): ClassDecorator =>
  SetMetadata(MODULE_NAME_KEY, moduleName);

// Method-level: names the rule within that module required to access this route.
export const RequireRule = (ruleName: string): MethodDecorator =>
  SetMetadata(RULE_NAME_KEY, ruleName);
