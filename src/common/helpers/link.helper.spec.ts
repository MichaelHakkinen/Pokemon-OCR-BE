import { isSafeLink } from './link.helper';

describe('isSafeLink', () => {
  it.each([
    'https://example.com/promo/1',
    'http://localhost:3000/x?y=1#z',
    '/promo/summer-sale',
    '/',
  ])('accepts %s', (value) => expect(isSafeLink(value)).toBe(true));

  it.each([
    ['javascript:', 'javascript:alert(1)'],
    ['JaVaScRiPt: (case)', 'JaVaScRiPt:alert(1)'],
    ['data:', 'data:text/html,<script>alert(1)</script>'],
    ['vbscript:', 'vbscript:msgbox(1)'],
    ['protocol-relative', '//evil.example.com'],
    ['backslash trick', '/\\evil.example.com'],
    ['relative without slash', 'promo/1'],
    ['mailto:', 'mailto:a@b.co'],
    ['whitespace inside', 'https://exa mple.com'],
    ['leading space', ' https://example.com'],
    ['control char', '/promo\u0000'],
    ['empty', ''],
    ['non-string', 42],
  ])('rejects %s', (_label, value) => expect(isSafeLink(value)).toBe(false));
});
