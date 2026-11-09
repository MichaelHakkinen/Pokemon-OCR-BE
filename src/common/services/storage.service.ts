import {
  Injectable,
  BadRequestException,
  Logger,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Service } from './s3.service';
import { ObsService } from './obs.service';
import * as fs from 'fs';
import * as path from 'path';
import { randomBytes } from 'crypto';
import { detectFileType } from '../helpers/file-type.helper';
import {
  FileKind,
  LOCAL_UPLOAD_DIR,
  UPLOAD_FOLDERS,
  UploadFolder,
} from '../config/upload.config';
import { ErrorMessageHelper } from '../helpers/error-message.helper';

export { UPLOAD_FOLDERS } from '../config/upload.config';
export type { UploadFolder, FileKind } from '../config/upload.config';

export interface UploadOptions {
  folder?: UploadFolder;
  prefix?: string;
  identifier?: string;
  customName?: string;
  // Kinds of content accepted (default: ['image']), checked against the
  // file's bytes — not its name or declared type. See FILE_TYPES.
  accept?: FileKind[];
}

// Matches "<upload folder>/<file name>" with safe characters only.
const MANAGED_KEY = new RegExp(
  `^(${UPLOAD_FOLDERS.join('|')})/[A-Za-z0-9._-]+$`,
);

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly diskStorage: string;
  private readonly uploadPath: string;

  constructor(
    private configService: ConfigService,
    private s3Service: S3Service,
    private obsService: ObsService,
  ) {
    this.diskStorage = this.configService.get('DISK_STORAGE', 'local');
    this.uploadPath = path.join(process.cwd(), LOCAL_UPLOAD_DIR);

    // Ensure upload directory exists for local storage
    if (this.diskStorage === 'local' && !fs.existsSync(this.uploadPath)) {
      fs.mkdirSync(this.uploadPath, { recursive: true });
    }

    this.logger.log(`Storage mode initialized: ${this.diskStorage}`);
  }

  /**
   * Normalize text for safe filename usage
   * Removes/replaces special characters, spaces, and ensures URL-safe names
   */
  private normalizeFilename(text: string): string {
    if (!text || text.trim() === '') {
      return 'file';
    }

    return (
      text
        .trim()
        .toLowerCase()
        // Replace spaces with hyphens
        .replace(/\s+/g, '-')
        // Remove special characters that might cause issues
        .replace(/['"`]/g, '') // Remove quotes
        .replace(/[#$%&*()\[\]{}]/g, '') // Remove special symbols
        .replace(/[<>:"/\\|?*]/g, '') // Remove invalid filename chars
        // Replace multiple hyphens with single hyphen
        .replace(/-+/g, '-')
        // Remove leading/trailing hyphens
        .replace(/^-+|-+$/g, '')
        // Remove any remaining non-alphanumeric except hyphens and underscores
        .replace(/[^a-z0-9-_]/g, '')
        // Limit length to 50 characters
        .substring(0, 50) ||
      // Ensure not empty after sanitization
      'file'
    );
  }

  /**
   * Upload file to the configured storage (local/S3/OBS)
   *
   * @param file - The file to upload (from multer)
   * @param options - Upload options
   * @param options.folder - Folder/directory name (default: 'uploads')
   * @param options.identifier - Unique identifier for the file (e.g., user ID, username)
   * @param options.customName - Custom file name without extension
   * @param options.prefix - Prefix for the filename (used mainly for OBS)
   *
   * @returns Promise<string> - Returns the file URL or path:
   *   - Local: 'uploads/folder/filename.ext'
   *   - S3: 'https://bucket.s3.region.amazonaws.com/folder/filename.ext'
   *   - OBS: 'https://bucket.obs.region.myhuaweicloud.com/folder/filename.ext'
   *
   * @example
   * // Basic upload
   * const url = await this.storageService.uploadFile(file, {
   *   folder: 'avatar-admin',
   *   identifier: 'admin-123'
   * });
   *
   * @example
   * // Upload with custom name
   * const url = await this.storageService.uploadFile(file, {
   *   folder: 'documents',
   *   customName: 'invoice-2024-01',
   *   identifier: 'user-456'
   * });
   *
   * @example
   * // Upload for OBS with prefix
   * const url = await this.storageService.uploadFile(file, {
   *   folder: 'avatar-user',
   *   prefix: 'user',
   *   identifier: user.fullname || 'unknown'
   * });
   */
  async uploadFile(
    file: Express.Multer.File,
    options: UploadOptions = {},
  ): Promise<string> {
    // The stored name's extension and Content-Type come from the detected
    // content — a forged "x.html" sent as image/png is rejected here instead
    // of being stored as .html and served from the API's origin.
    const detected = detectFileType(file?.buffer);
    const accept = options.accept ?? ['image'];
    if (!detected || !accept.includes(detected.kind)) {
      throw new UnprocessableEntityException(
        ErrorMessageHelper.getMultiLanguageMessage('UNSUPPORTED_FILE_CONTENT'),
      );
    }
    const safeFile: Express.Multer.File = {
      ...file,
      originalname: `upload.${detected.ext}`,
      mimetype: detected.mime,
    };

    // Set defaults for all options
    const uploadOptions: UploadOptions = {
      folder: options.folder || 'banner',
      prefix: options.prefix || 'file',
      identifier: options.identifier,
      customName: options.customName,
    };

    switch (this.diskStorage) {
      case 's3':
        return await this.uploadToS3(safeFile, uploadOptions);
      case 'obs':
        return await this.uploadToOBS(safeFile, uploadOptions);
      case 'local':
      default:
        return await this.uploadToLocal(safeFile, uploadOptions);
    }
  }

  /**
   * Upload to local storage
   */
  /**
   * Stored file name (without extension). Always ends in a timestamp and a
   * random part, so two uploads with the same customName / identifier in the
   * same millisecond never overwrite each other — and replacing a file never
   * reuses the old name (withUpload deletes the old one afterwards).
   */
  private uniqueStem(
    prefix: string,
    identifier: string | null,
    customName: string | null,
  ): string {
    const unique = `${Date.now()}-${randomBytes(4).toString('hex')}`;
    if (customName) return `${customName}-${unique}`;
    if (identifier) return `${prefix}-${identifier}-${unique}`;
    return `${prefix}-${unique}`;
  }

  private async uploadToLocal(
    file: Express.Multer.File,
    options: UploadOptions,
  ): Promise<string> {
    try {
      const fileExt = file.originalname.split('.').pop();

      const {
        folder = 'uploads',
        prefix = 'file',
        identifier,
        customName,
      } = options;

      // Normalize inputs
      const normalizedPrefix = this.normalizeFilename(prefix);
      const normalizedIdentifier = identifier
        ? this.normalizeFilename(identifier)
        : null;
      const normalizedCustomName = customName
        ? this.normalizeFilename(customName)
        : null;

      const fileName = `${this.uniqueStem(
        normalizedPrefix,
        normalizedIdentifier,
        normalizedCustomName,
      )}.${fileExt}`;

      const folderPath = path.join(this.uploadPath, folder);

      // Ensure folder exists
      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
      }

      const filePath = path.join(folderPath, fileName);
      fs.writeFileSync(filePath, file.buffer);

      // Return relative path from project root
      return `${LOCAL_UPLOAD_DIR}/${folder}/${fileName}`;
    } catch (error) {
      this.logger.error('Error uploading file to local storage:', error);
      throw new BadRequestException(
        `Failed to upload file to local storage: ${error.message}`,
      );
    }
  }

  /**
   * Upload to AWS S3
   */
  private async uploadToS3(
    file: Express.Multer.File,
    options: UploadOptions,
  ): Promise<string> {
    try {
      const {
        folder = 'uploads',
        prefix = 'file',
        identifier,
        customName,
      } = options;

      // Normalize inputs
      const normalizedPrefix = this.normalizeFilename(prefix);
      const normalizedIdentifier = identifier
        ? this.normalizeFilename(identifier)
        : null;
      const normalizedCustomName = customName
        ? this.normalizeFilename(customName)
        : null;

      const fileIdentifier = this.uniqueStem(
        normalizedPrefix,
        normalizedIdentifier,
        normalizedCustomName,
      );
      const fileName = fileIdentifier;

      return await this.s3Service.uploadFile(
        file,
        folder,
        fileIdentifier,
        fileName,
      );
    } catch (error) {
      this.logger.error('Error uploading file to S3:', error);
      throw new BadRequestException(
        `Failed to upload file to S3: ${error.message}`,
      );
    }
  }

  /**
   * Upload to Huawei OBS
   */
  private async uploadToOBS(
    file: Express.Multer.File,
    options: UploadOptions,
  ): Promise<string> {
    try {
      const {
        folder = 'uploads',
        prefix = 'file',
        identifier = 'unknown',
        customName,
      } = options;

      // Normalize inputs
      const normalizedPrefix = this.normalizeFilename(prefix);
      const normalizedIdentifier = this.normalizeFilename(identifier);
      const normalizedCustomName = customName
        ? this.normalizeFilename(customName)
        : null;

      const fileName = await this.obsService.uploadImage(file, {
        folder,
        prefix: normalizedPrefix,
        identifier: normalizedIdentifier,
        customName: normalizedCustomName,
      });

      // Generate the full OBS URL
      return this.obsService.generatePublicUrl(fileName);
    } catch (error) {
      this.logger.error('Error uploading file to OBS:', error);
      throw new BadRequestException(
        `Failed to upload file to OBS: ${error.message}`,
      );
    }
  }

  /**
   * Upload a file (optional) and save it, without ever leaving a dangling
   * reference or an orphaned file:
   *   1. upload the new file (if any),
   *   2. run `save(storedRef)` — your DB write,
   *   3. only after `save` succeeds, delete the file it `replaces`.
   * If `save` throws, the new upload is deleted and the old file is kept.
   *
   * @example
   * const admin = await this.storageService.withUpload(
   *   { file: avatar, options: { folder: 'avatar-admin', prefix: 'admin' }, replaces: admin.avatar },
   *   (avatarUrl) => this.prisma.admin.update({ where: { id }, data: { avatar: avatarUrl ?? undefined } }),
   * );
   */
  async withUpload<T>(
    upload: {
      file?: Express.Multer.File | null;
      options: UploadOptions;
      replaces?: string | null;
    },
    save: (storedRef: string | null) => Promise<T>,
  ): Promise<T> {
    const stored = upload.file
      ? await this.uploadFile(upload.file, upload.options)
      : null;
    let result: T;
    try {
      result = await save(stored);
    } catch (error) {
      if (stored) await this.deleteFile(stored);
      throw error;
    }
    if (stored && upload.replaces && upload.replaces !== stored) {
      await this.deleteFile(upload.replaces); // best effort; logs on failure
    }
    return result;
  }

  /**
   * Delete file from the configured storage
   *
   * @param filePathOrUrl - File path (local) or full URL (S3/OBS)
   *   - Local: 'uploads/folder/filename.ext'
   *   - S3/OBS: Full URL returned from uploadFile()
   *
   * @returns Promise<boolean> - true if deleted successfully, false otherwise
   *
   * @example
   * // Delete file
   * const deleted = await this.storageService.deleteFile(fileUrl);
   * if (deleted) {
   *   console.log('File deleted successfully');
   * }
   *
   * @example
   * // Delete old avatar before uploading new one
   * if (user.avatar) {
   *   await this.storageService.deleteFile(user.avatar);
   * }
   * const newAvatar = await this.storageService.uploadFile(file, {...});
   */
  async deleteFile(filePathOrUrl: string): Promise<boolean> {
    if (!filePathOrUrl) return false;
    try {
      switch (this.diskStorage) {
        case 's3': {
          const key = this.s3Service.extractKeyFromUrl(filePathOrUrl);
          if (!this.isManagedKey(key, filePathOrUrl)) return false;
          await this.s3Service.deleteFileByUrl(filePathOrUrl);
          return true;
        }
        case 'obs': {
          // Extract filename from URL for OBS
          const obsFileName = this.extractObsFileName(filePathOrUrl);
          if (!this.isManagedKey(obsFileName, filePathOrUrl)) return false;
          return await this.obsService.deleteFile(obsFileName);
        }
        case 'local':
        default:
          return await this.deleteFromLocal(filePathOrUrl);
      }
    } catch (error) {
      this.logger.error('Error deleting file:', error);
      return false;
    }
  }

  /**
   * Delete from local storage
   */
  private async deleteFromLocal(relativePath: string): Promise<boolean> {
    try {
      // Remove 'src/public/' prefix if it exists (to handle both old and new path formats)
      const normalizedPath = relativePath.startsWith('src/public/')
        ? relativePath.substring('src/public/'.length)
        : relativePath.startsWith('src\\public\\')
          ? relativePath.substring('src\\public\\'.length)
          : relativePath;

      // resolve() collapses "..", so this prefix check keeps deletes inside the
      // uploads folder — a crafted path like "../../.env" is refused.
      const filePath = path.resolve(
        process.cwd(),
        'src',
        'public',
        normalizedPath,
      );
      const managedFolder = UPLOAD_FOLDERS.some((folder) =>
        filePath.startsWith(path.join(this.uploadPath, folder) + path.sep),
      );
      if (!managedFolder) {
        this.logger.warn(`Refusing to delete unmanaged path: ${relativePath}`);
        return false;
      }
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        this.logger.log(`File deleted successfully: ${relativePath}`);
        return true;
      }
      return false;
    } catch (error) {
      this.logger.error('Error deleting file from local storage:', error);
      return false;
    }
  }

  /**
   * Get public URL for a file
   *
   * @param filePathOrKey - File path/key or existing URL
   *   - If already a URL (starts with 'http'), returns as-is
   *   - Otherwise, generates public URL based on storage type
   *
   * @returns string - Public URL to access the file
   *   - Local: 'http://localhost:3000/uploads/folder/filename.ext'
   *   - S3: 'https://bucket.s3.region.amazonaws.com/key'
   *   - OBS: 'https://bucket.obs.region.myhuaweicloud.com/key'
   *
   * @example
   * // Get public URL
   * const publicUrl = this.storageService.getPublicUrl(filePath);
   *
   * @example
   * // Use in response
   * return {
   *   ...user,
   *   avatarUrl: this.storageService.getPublicUrl(user.avatar)
   * };
   */
  getPublicUrl(filePathOrKey: string): string {
    switch (this.diskStorage) {
      case 's3':
        // If it's already a full URL, return it
        if (filePathOrKey.startsWith('http')) {
          return filePathOrKey;
        }
        return this.s3Service.getPublicUrl(filePathOrKey);
      case 'obs':
        // If it's already a full URL, return it
        if (filePathOrKey.startsWith('http')) {
          return filePathOrKey;
        }
        return this.obsService.generatePublicUrl(filePathOrKey);
      case 'local':
      default:
        // Return relative path for local storage
        const baseUrl = this.configService.get(
          'APP_URL',
          'http://localhost:3000',
        );
        return `${baseUrl}/${filePathOrKey}`;
    }
  }

  /**
   * Generate signed/presigned URL for temporary access (S3/OBS)
   * For local storage, returns the public URL
   *
   * @param filePathOrUrl - File path or URL
   * @param expiresInSeconds - URL expiration time in seconds (default: 3600 = 1 hour)
   *
   * @returns Promise<string> - Temporary URL with expiration
   *
   * @example
   * // Generate 1-hour temporary URL
   * const tempUrl = await this.storageService.getSignedUrl(fileUrl);
   *
   * @example
   * // Generate 24-hour temporary URL
   * const tempUrl = await this.storageService.getSignedUrl(fileUrl, 86400);
   *
   * @example
   * // Use for private documents
   * const document = await this.documentService.findOne(id);
   * const downloadUrl = await this.storageService.getSignedUrl(
   *   document.fileUrl,
   *   3600 // 1 hour
   * );
   * return { downloadUrl };
   */
  async getSignedUrl(
    filePathOrUrl: string,
    expiresInSeconds: number = 3600,
  ): Promise<string> {
    switch (this.diskStorage) {
      case 's3':
        return await this.s3Service.getSignedUrlByUrl(
          filePathOrUrl,
          expiresInSeconds,
        );
      case 'obs':
        const obsFileName = this.extractObsFileName(filePathOrUrl);
        return await this.obsService.generatePresignedUrl(
          obsFileName,
          expiresInSeconds,
        );
      case 'local':
      default:
        // For local storage, just return the public URL
        return this.getPublicUrl(filePathOrUrl);
    }
  }

  /**
   * Check if file exists in storage
   *
   * @param filePathOrUrl - File path (local) or URL (S3/OBS)
   *
   * @returns Promise<boolean> - true if file exists, false otherwise
   *
   * @example
   * // Check before deleting
   * if (await this.storageService.fileExists(fileUrl)) {
   *   await this.storageService.deleteFile(fileUrl);
   * }
   *
   * @example
   * // Validate file before processing
   * const exists = await this.storageService.fileExists(user.avatar);
   * if (!exists) {
   *   throw new NotFoundException('Avatar file not found');
   * }
   */
  async fileExists(filePathOrUrl: string): Promise<boolean> {
    try {
      switch (this.diskStorage) {
        case 's3':
          // S3Service doesn't have fileExists, so we try to get signed URL
          try {
            await this.s3Service.getSignedUrlByUrl(filePathOrUrl, 1);
            return true;
          } catch {
            return false;
          }
        case 'obs':
          const obsFileName = this.extractObsFileName(filePathOrUrl);
          return await this.obsService.fileExists(obsFileName);
        case 'local':
        default:
          const filePath = path.join(
            process.cwd(),
            'src',
            'public',
            filePathOrUrl,
          );
          return fs.existsSync(filePath);
      }
    } catch {
      return false;
    }
  }

  // Only "<upload folder>/<file>" keys produced by uploadFile() may be deleted.
  private isManagedKey(key: string, original: string): boolean {
    if (MANAGED_KEY.test(key)) return true;
    this.logger.warn(`Refusing to delete unmanaged object: ${original}`);
    return false;
  }

  /**
   * Extract OBS filename from URL
   */
  private extractObsFileName(url: string): string {
    if (!/^https?:\/\//i.test(url)) return url;
    // Our hosts only: the bucket's *.myhuaweicloud.com domain or the custom
    // CDN domain (OBS_DOMAIN_NAME) generatePublicUrl() builds URLs with. The
    // key is the path, URL-decoded (generatePublicUrl encodes it). A foreign
    // URL yields itself, which isManagedKey() then rejects.
    try {
      const { hostname, pathname } = new URL(url);
      const cdnDomain = String(this.configService.get('OBS_DOMAIN_NAME') ?? '')
        .replace(/^https?:\/\//i, '')
        .replace(/\/.*$/, '')
        .toLowerCase();
      const ours =
        hostname.endsWith('.myhuaweicloud.com') ||
        (cdnDomain !== '' && hostname === cdnDomain.replace(/:\d+$/, ''));
      if (!ours) return url;
      return decodeURIComponent(pathname.replace(/^\/+/, ''));
    } catch {
      return url;
    }
  }

  /**
   * Get current storage type from environment configuration
   *
   * @returns string - Current storage type: 'local', 's3', or 'obs'
   *
   * @example
   * // Check current storage
   * const storageType = this.storageService.getStorageType();
   * console.log(`Using ${storageType} storage`);
   *
   * @example
   * // Conditional logic based on storage
   * if (this.storageService.getStorageType() === 'local') {
   *   // Local-specific logic
   * }
   */
  getStorageType(): string {
    return this.diskStorage;
  }
}
