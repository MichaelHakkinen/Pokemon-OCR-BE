import { ForbiddenException } from '@nestjs/common';
import { assertCanGrantRules, isRootAdmin } from './rbac.helpers';

const caller = (groups: string[], ruleIds: string[]) => ({
  adminGroupDetail: {
    groups: groups.map((name, i) => ({ id: String(i), name })),
    modules: [{ name: 'M', rules: ruleIds.map((id) => ({ id, name: id })) }],
  },
});

describe('rbac helpers', () => {
  it('recognises *root', () => {
    expect(isRootAdmin(caller(['*root'], []))).toBe(true);
    expect(isRootAdmin(caller(['Ops'], []))).toBe(false);
    expect(isRootAdmin(undefined)).toBe(false);
  });

  it('lets root grant anything', () => {
    expect(() =>
      assertCanGrantRules(caller(['*root'], []), ['x', 'y']),
    ).not.toThrow();
  });

  it('lets an admin grant rules they hold', () => {
    expect(() =>
      assertCanGrantRules(caller(['Ops'], ['a', 'b']), ['a']),
    ).not.toThrow();
  });

  it('forbids granting a rule the admin does not hold', () => {
    expect(() =>
      assertCanGrantRules(caller(['Ops'], ['a']), ['a', 'z']),
    ).toThrow(ForbiddenException);
  });

  it('allows keeping rules the group already has', () => {
    expect(() =>
      assertCanGrantRules(caller(['Ops'], ['a']), ['a', 'z'], ['z']),
    ).not.toThrow();
  });

  it('treats a missing caller as holding nothing', () => {
    expect(() => assertCanGrantRules(undefined, ['a'])).toThrow(
      ForbiddenException,
    );
    expect(() => assertCanGrantRules(undefined, [])).not.toThrow();
  });
});
