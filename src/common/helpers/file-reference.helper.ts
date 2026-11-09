import { ValidateBy, ValidationOptions } from 'class-validator';
import { LOCAL_UPLOAD_DIR, UploadFolder } from '../config/upload.config';

/**
 * A "file reference" is what modules store for a file: either an external
 * http(s) URL (S3/OBS uploads are stored as URLs too), or a local upload path
 * `src/public/uploads/<folder>/<file>` in one of the given folders.
 *
 * Validate every reference that comes from a client (DTO fields, imported
 * rows) — stored references are later passed to StorageService.deleteFile()
 * when the file is replaced, so arbitrary paths ("../../.env") must never be
 * accepted. Anything else (javascript:, data:, relative paths) is rejected.
 */
export function isFileReference(
  value: unknown,
  folders: UploadFolder | UploadFolder[],
): boolean {
  if (typeof value !== 'string' || value.trim() !== value || !value) {
    return false;
  }
  const allowed = Array.isArray(folders) ? folders : [folders];
  const local = value.match(
    new RegExp(`^${LOCAL_UPLOAD_DIR}/([a-z0-9-]+)/[A-Za-z0-9._-]+$`),
  );
  if (local) return allowed.includes(local[1] as UploadFolder);
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

/**
 * DTO decorator: the property must be a file reference (see isFileReference)
 * in the given upload folder(s). Message key IS_FILE_REFERENCE is translated
 * by TranslatedValidationPipe.
 *
 *   @IsFileReference('banner')
 *   mediaUrl: string;
 */
export const IsFileReference = (
  folders: UploadFolder | UploadFolder[],
  options?: ValidationOptions,
) =>
  ValidateBy(
    {
      name: 'isFileReference',
      constraints: [folders],
      validator: {
        validate: (value) => isFileReference(value, folders),
      },
    },
    { message: 'IS_FILE_REFERENCE', ...options },
  );
