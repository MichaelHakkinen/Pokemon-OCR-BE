import { validateSync } from 'class-validator';
import { IsFileReference, isFileReference } from './file-reference.helper';

describe('isFileReference', () => {
  it.each([
    'https://cdn.example.com/banner/a.png',
    'http://localhost:3000/response/x',
    'https://bucket.s3.region.amazonaws.com/banner/x.png',
    'src/public/uploads/banner/banner-x-1.png',
  ])('accepts %s for the banner folder', (value) => {
    expect(isFileReference(value, 'banner')).toBe(true);
  });

  it.each([
    ['path traversal', '../../.env'],
    ['traversal inside uploads', 'src/public/uploads/../../.env'],
    ['traversal via folder', 'src/public/uploads/banner/../../../package.json'],
    ['another module folder', 'src/public/uploads/avatar-admin/a.png'],
    ['unknown folder', 'src/public/uploads/secrets/a.png'],
    ['javascript: URL', 'javascript:alert(1)'],
    ['data: URL', 'data:text/html,<script>alert(1)</script>'],
    ['relative path', 'banner/a.png'],
    ['surrounding whitespace', ' https://cdn.example.com/a.png'],
    ['empty', ''],
    ['non-string', { text: 'x', hyperlink: 'https://x' }],
  ])('rejects %s', (_label, value) => {
    expect(isFileReference(value, 'banner')).toBe(false);
  });

  it('accepts any of several folders', () => {
    const avatar = 'src/public/uploads/avatar-user/u.png';
    expect(isFileReference(avatar, ['avatar-admin', 'avatar-user'])).toBe(true);
    expect(isFileReference(avatar, 'avatar-admin')).toBe(false);
  });

  it('works as a DTO decorator', () => {
    class Dto {
      @IsFileReference('banner')
      mediaUrl: string;
    }
    const bad = Object.assign(new Dto(), { mediaUrl: '../../.env' });
    const good = Object.assign(new Dto(), {
      mediaUrl: 'https://cdn.example.com/a.png',
    });
    const [error] = validateSync(bad);
    expect(error.constraints).toEqual({ isFileReference: 'IS_FILE_REFERENCE' });
    expect(validateSync(good)).toHaveLength(0);
  });
});
