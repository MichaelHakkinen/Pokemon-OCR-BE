import {
  extensionsOf,
  FILE_TYPES,
  mimeRegexOf,
  UPLOAD_FOLDERS,
} from './upload.config';

describe('upload.config', () => {
  it('lists extensions per kind, including aliases', () => {
    expect(extensionsOf(['image'])).toEqual(['png', 'jpg', 'jpeg', 'webp']);
    expect(extensionsOf(['video'])).toEqual(
      expect.arrayContaining([
        'mp4',
        'mov',
        'avi',
        'wmv',
        'flv',
        'webm',
        'mkv',
      ]),
    );
  });

  it('builds an anchored mimetype pre-check', () => {
    const images = mimeRegexOf(['image']);
    expect(images.test('image/png')).toBe(true);
    expect(images.test('image/jpg')).toBe(true);
    expect(images.test('x/png')).toBe(false); // the old unanchored regex allowed this
    expect(images.test('image/png; charset=x')).toBe(false);
    expect(images.test('video/mp4')).toBe(false);
    expect(mimeRegexOf(['video']).test('video/x-ms-wmv')).toBe(true);
  });

  it('has a unique stored extension per type', () => {
    const exts = FILE_TYPES.map((t) => t.ext);
    expect(new Set(exts).size).toBe(exts.length);
  });

  it('uses folder names that are safe in paths and keys', () => {
    for (const folder of UPLOAD_FOLDERS) expect(folder).toMatch(/^[a-z0-9-]+$/);
  });
});
