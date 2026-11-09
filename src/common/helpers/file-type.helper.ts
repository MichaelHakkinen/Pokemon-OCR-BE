import { FILE_TYPES, FileTypeDef } from '../config/upload.config';

// Identifies uploads by their content (magic bytes, see FILE_TYPES), never by
// the client-supplied filename or Content-Type, which are trivially forged
// (e.g. an HTML page sent as "photo.png" with type image/png).
export type DetectedFileType = Pick<FileTypeDef, 'ext' | 'mime' | 'kind'>;

export function detectFileType(buf: Buffer): DetectedFileType | null {
  if (!buf || buf.length < 12) return null;
  const type = FILE_TYPES.find((t) => t.matches(buf));
  return type ? { ext: type.ext, mime: type.mime, kind: type.kind } : null;
}
