import { detectFileType } from './file-type.helper';

const pad = (head: number[] | string, size = 64) => {
  const start =
    typeof head === 'string' ? Buffer.from(head, 'latin1') : Buffer.from(head);
  return Buffer.concat([start, Buffer.alloc(Math.max(0, size - start.length))]);
};

describe('detectFileType', () => {
  it.each([
    ['png', pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), 'image/png'],
    ['jpg', pad([0xff, 0xd8, 0xff, 0xe0]), 'image/jpeg'],
    ['webp', pad('RIFF\0\0\0\0WEBPVP8 '), 'image/webp'],
    ['mp4', pad('\0\0\0\x18ftypisom'), 'video/mp4'],
    ['mov', pad('\0\0\0\x14ftypqt  '), 'video/quicktime'],
    ['avi', pad('RIFF\0\0\0\0AVI LIST'), 'video/x-msvideo'],
    [
      'wmv',
      pad([0x30, 0x26, 0xb2, 0x75, 0x8e, 0x66, 0xcf, 0x11]),
      'video/x-ms-wmv',
    ],
    ['flv', pad('FLV\x01'), 'video/x-flv'],
    ['webm', pad('\x1a\x45\xdf\xa3\x9fB\x82\x84webm'), 'video/webm'],
    ['mkv', pad('\x1a\x45\xdf\xa3\x9fB\x82\x88matroska'), 'video/x-matroska'],
  ])('recognises %s', (ext, buf, mime) => {
    expect(detectFileType(buf)).toMatchObject({ ext, mime });
  });

  it.each([
    ['HTML', pad('<!doctype html><script>alert(1)</script>')],
    ['SVG', pad('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>')],
    ['plain text', pad('hello world, definitely not an image')],
    ['ZIP/XLSX', pad('PK\x03\x04')],
    ['too short', Buffer.from([0x89, 0x50])],
    ['empty', Buffer.alloc(0)],
  ])('rejects %s', (_label, buf) => {
    expect(detectFileType(buf)).toBeNull();
  });
});
