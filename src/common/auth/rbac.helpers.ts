import { ForbiddenException } from '@nestjs/common';
import { ErrorMessageHelper } from 'src/common/helpers/error-message.helper';
import type { AdminGroupDetail } from './admin-access.service';

export const ROOT_GROUP = '*root';

// The caller's groups/rules as attached by AdminAuthGuard (request.user).
type Caller = { adminGroupDetail?: AdminGroupDetail } | undefined;

export function isRootAdmin(caller: Caller): boolean {
  return !!caller?.adminGroupDetail?.groups?.some((g) => g.name === ROOT_GROUP);
}

export function grantedRuleIds(caller: Caller): Set<string> {
  const ids = new Set<string>();
  for (const module of caller?.adminGroupDetail?.modules ?? []) {
    for (const rule of module.rules ?? []) ids.add(rule.id);
  }
  return ids;
}

/**
 * A non-root admin may only *add* rules they hold themselves — otherwise
 * "Edit" on Admin Group Management would let them grant any permission,
 * including to their own group. Removing rules, and keeping rules a group
 * already has, is always allowed. *root may grant anything.
 */
export function assertCanGrantRules(
  caller: Caller,
  requestedRuleIds: string[] = [],
  existingRuleIds: string[] = [],
): void {
  if (isRootAdmin(caller)) return;
  const held = grantedRuleIds(caller);
  const existing = new Set(existingRuleIds);
  const notHeld = requestedRuleIds.filter(
    (id) => !existing.has(id) && !held.has(id),
  );
  if (notHeld.length > 0) {
    throw new ForbiddenException(
      ErrorMessageHelper.getMultiLanguageMessage('RULE_GRANT_FORBIDDEN'),
    );
  }
}
