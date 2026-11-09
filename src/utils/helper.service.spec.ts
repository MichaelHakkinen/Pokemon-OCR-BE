import { ForbiddenException } from '@nestjs/common';
import { HelperService, redactSecrets } from './helper.service';
import { testConfig } from 'src/common/config/config.testing';

describe('HelperService.checkAuthorization', () => {
  const helper = new HelperService({} as any, {} as any, testConfig());
  const detail = (groups: string[], modules: any[] = []) => ({
    groups: groups.map((name, i) => ({ id: String(i), name })),
    modules,
  });

  it('lets *root through everything', () => {
    expect(helper.checkAuthorization(detail(['*root']), 'FAQ', 'Edit')).toBe(
      true,
    );
  });

  it('allows a granted rule', () => {
    const modules = [{ name: 'FAQ', rules: [{ name: 'Edit' }] }];
    expect(
      helper.checkAuthorization(detail(['Editors'], modules), 'FAQ', 'Edit'),
    ).toBe(true);
  });

  it('returns 403 for a missing rule', () => {
    const modules = [{ name: 'FAQ', rules: [{ name: 'View List' }] }];
    expect(() =>
      helper.checkAuthorization(detail(['Editors'], modules), 'FAQ', 'Delete'),
    ).toThrow(ForbiddenException);
  });
});

describe('redactSecrets (audit-log serialisation)', () => {
  it('removes credentials at any depth', () => {
    const row = {
      id: '1',
      password: '$2b$10$hash',
      nested: { token: 't', otp: '123456', name: 'x' },
      list: [{ resetToken: 'r', refreshToken: 'f' }],
    };
    const json = JSON.stringify(row, redactSecrets);
    expect(json).not.toMatch(/\$2b\$|"t"|123456|"r"|"f"/);
    expect(JSON.parse(json)).toMatchObject({ id: '1', nested: { name: 'x' } });
  });
});
