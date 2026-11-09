// Single source of truth for file uploads. Modules never hard-code folders,
// types or paths — they import from here (see README "File Upload & Storage").

/**
 * Folders uploads are stored in (local disk, S3 or OBS).
 * StorageService.deleteFile() only deletes files inside these folders, and
 * isFileReference() only accepts stored paths in them — so a crafted path or
 * URL can never point a delete at anything else.
 *
 * Adding uploads to a new module? Add its folder here, e.g. 'product-image'.
 */
export const UPLOAD_FOLDERS = [
  'avatar-admin',
  'avatar-user',
  'banner',
] as const;
export type UploadFolder = (typeof UPLOAD_FOLDERS)[number];

/** Where local uploads live, relative to the project root. */
export const LOCAL_UPLOAD_DIR = 'src/public/uploads';

export type FileKind = 'image' | 'video';

export interface FileTypeDef {
  /** Extension used for the stored file. */
  ext: string;
  /** Other extensions clients may use for this type (multer pre-check). */
  extAliases?: string[];
  mime: string;
  /** Other mimetypes clients send for this type (multer pre-check). */
  mimeAliases?: string[];
  kind: FileKind;
  /** Recognises the type from the file's first bytes. */
  matches: (head: Buffer) => boolean;
}

const bytesAt = (buf: Buffer, bytes: number[], offset = 0) =>
  buf.length >= offset + bytes.length &&
  bytes.every((byte, i) => buf[offset + i] === byte);
const textAt = (buf: Buffer, text: string, offset = 0) =>
  bytesAt(
    buf,
    [...text].map((c) => c.charCodeAt(0)),
    offset,
  );

/**
 * Every file type uploads may have, identified by content (magic bytes), not
 * by the client's filename or Content-Type. Order matters: the first match
 * wins. To accept a new type, add an entry here (and, if it's a new kind,
 * extend FileKind and UPLOAD_SIZE_LIMITS).
 */
export const FILE_TYPES: FileTypeDef[] = [
  {
    ext: 'png',
    mime: 'image/png',
    kind: 'image',
    matches: (b) =>
      bytesAt(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  },
  {
    ext: 'jpg',
    extAliases: ['jpeg'],
    mime: 'image/jpeg',
    mimeAliases: ['image/jpg'],
    kind: 'image',
    matches: (b) => bytesAt(b, [0xff, 0xd8, 0xff]),
  },
  {
    ext: 'webp',
    mime: 'image/webp',
    kind: 'image',
    matches: (b) => textAt(b, 'RIFF') && textAt(b, 'WEBP', 8),
  },
  {
    // ISO base media — QuickTime brand first, everything else is MP4
    ext: 'mov',
    mime: 'video/quicktime',
    mimeAliases: ['video/mov'],
    kind: 'video',
    matches: (b) => textAt(b, 'ftyp', 4) && textAt(b, 'qt  ', 8),
  },
  {
    ext: 'mp4',
    mime: 'video/mp4',
    kind: 'video',
    matches: (b) => textAt(b, 'ftyp', 4),
  },
  {
    ext: 'avi',
    mime: 'video/x-msvideo',
    mimeAliases: ['video/avi'],
    kind: 'video',
    matches: (b) => textAt(b, 'RIFF') && textAt(b, 'AVI ', 8),
  },
  {
    ext: 'wmv',
    mime: 'video/x-ms-wmv',
    mimeAliases: ['video/wmv'],
    kind: 'video',
    matches: (b) =>
      bytesAt(b, [0x30, 0x26, 0xb2, 0x75, 0x8e, 0x66, 0xcf, 0x11]),
  },
  {
    ext: 'flv',
    mime: 'video/x-flv',
    kind: 'video',
    matches: (b) => textAt(b, 'FLV'),
  },
  {
    // EBML container: the DocType says webm or matroska
    ext: 'webm',
    mime: 'video/webm',
    kind: 'video',
    matches: (b) =>
      bytesAt(b, [0x1a, 0x45, 0xdf, 0xa3]) &&
      b.subarray(0, 64).toString('latin1').includes('webm'),
  },
  {
    ext: 'mkv',
    mime: 'video/x-matroska',
    kind: 'video',
    matches: (b) => bytesAt(b, [0x1a, 0x45, 0xdf, 0xa3]),
  },
];

/** Default multer size limits per kind of upload. */
export const UPLOAD_SIZE_LIMITS: Record<FileKind, number> = {
  image: 5 * 1024 * 1024, // 5 MB
  video: 50 * 1024 * 1024, // 50 MB
};

/** File types of the given kinds. */
export const fileTypesOf = (kinds: FileKind[]) =>
  FILE_TYPES.filter((t) => kinds.includes(t.kind));

/** Extensions (incl. aliases) of the given kinds, e.g. for error messages. */
export const extensionsOf = (kinds: FileKind[]) =>
  fileTypesOf(kinds).flatMap((t) => [t.ext, ...(t.extAliases ?? [])]);

/**
 * Anchored regex over the client-sent mimetypes of the given kinds — a cheap
 * multer pre-check only; StorageService still verifies the actual content.
 */
export const mimeRegexOf = (kinds: FileKind[]) => {
  const mimes = fileTypesOf(kinds).flatMap((t) => [
    t.mime,
    ...(t.mimeAliases ?? []),
  ]);
  const escaped = mimes.map((m) => m.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&'));
  return new RegExp(`^(${escaped.join('|')})$`);
};
