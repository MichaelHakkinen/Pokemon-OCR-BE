/**
 * Service to handle Huawei OBS file operations
 * Requires Huawei OBS SDK
 * Make sure to set the following environment variables:
 * # Huawei OBS Configuration
 * OBS_ACCESS_KEY_ID=your-obs-access-key-id
 * OBS_SECRET_ACCESS_KEY=your-obs-secret-access-key
 * OBS_ENDPOINT=obs.ap-southeast-1.myhuaweicloud.com
 * OBS_BUCKET_NAME=your-bucket-name
 * OBS_DOMAIN_NAME=your-bucket-name.obs.ap-southeast-1.myhuaweicloud.com
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../config/env.validation';
import { createHash } from 'crypto';
import * as ObsClient from 'esdk-obs-nodejs';
import { Readable } from 'stream';

@Injectable()
export class ObsService {
  private readonly logger = new Logger(ObsService.name);
  private obsClient: any;
  private bucketName: string;
  private isConfigured: boolean = false;

  // Prefixes for assets that should be served as plain CDN URLs (no signing required).
  // Override via CDN_UNSIGNED_PUBLIC_PREFIXES env var (comma/semicolon-separated).
  private readonly defaultUnsignedCdnPublicPrefixes: string[] = [];

  // Prefixes / extensions for assets that require CDN token authentication.
  // Override via CDN_TOKEN_PROTECTED_PREFIXES / CDN_TOKEN_PROTECTED_EXTENSIONS env vars.
  private readonly defaultCdnTokenProtectedPrefixes: string[] = [];
  private readonly defaultCdnTokenProtectedExtensions = [
    '.mp4',
    '.m3u8',
    '.ts',
    '.m4s',
    '.key',
  ];

  // With DISK_STORAGE=obs the env schema guarantees the OBS credentials are
  // set, so a missing value fails at boot rather than on first upload.
  constructor(private readonly config: ConfigService<AppConfig, true>) {
    if (config.get('DISK_STORAGE') === 'obs') {
      this.bucketName = config.get('OBS_BUCKET_NAME');

      this.obsClient = new ObsClient({
        access_key_id: config.get('OBS_ACCESS_KEY_ID'),
        secret_access_key: config.get('OBS_SECRET_ACCESS_KEY'),
        server: config.get('OBS_ENDPOINT'),
        signature: 'obs',
      });

      this.isConfigured = true;
      this.logger.log('OBS client initialized successfully');
    } else {
      this.logger.log('OBS storage not selected, skipping initialization');
    }
  }

  private checkConfiguration(): void {
    if (!this.isConfigured) {
      throw new Error(
        'OBS service is not configured. Set DISK_STORAGE=obs and provide OBS credentials.',
      );
    }
  }

  private toStream(buf: Buffer) {
    return Readable.from(buf);
  }

  /**
   * Upload file to Huawei OBS bucket (basic upload with automatic naming)
   *
   * @param file - The file to upload (from multer)
   * @param folder - OBS folder/prefix (default: 'uploads')
   *
   * @returns Promise<string> - OBS key (not full URL, use generatePublicUrl() for URL)
   */
  async uploadFile(
    file: Express.Multer.File,
    folder: string = 'uploads',
  ): Promise<string> {
    this.checkConfiguration();

    let fileName: string | undefined;
    try {
      const timestamp = Date.now();
      const randomSuffix = Math.round(Math.random() * 1e9);
      const fileExt = file.originalname.split('.').pop();
      fileName = `${folder}/${timestamp}-${randomSuffix}.${fileExt}`;

      const uploadParams = {
        Bucket: this.bucketName,
        Key: fileName,
        Body: file.buffer,
        ContentType: file.mimetype,
        ACL: this.obsClient.enums.AclPublicRead,
      };

      const result = await this.obsClient.putObject(uploadParams);

      if (result.CommonMsg.Status < 300) {
        this.logger.log(`File uploaded successfully: ${fileName}`);
        return fileName;
      } else {
        throw new Error(`Upload failed: ${result.CommonMsg.Code}`);
      }
    } catch (error) {
      this.logger.error(
        `OBS upload failed — folder=${folder} key=${fileName ?? 'unknown'} mimetype=${file.mimetype} size=${file.size}bytes error=${(error as Error)?.message}`,
        (error as Error)?.stack,
      );
      throw error;
    }
  }

  /**
   * Upload image with customizable folder structure and naming (recommended method)
   * Automatically handles special characters and generates safe filenames
   *
   * @param file - The file to upload (from multer)
   * @param options - Upload options
   * @param options.folder - OBS folder/prefix (default: 'images')
   * @param options.prefix - Filename prefix (default: 'img')
   * @param options.identifier - Unique identifier (e.g., username, user ID)
   * @param options.customName - Custom filename (will be sanitized)
   *
   * @returns Promise<string> - OBS key (not full URL, use generatePublicUrl() for URL)
   */
  async uploadImage(
    file: Express.Multer.File,
    options: {
      folder?: string;
      prefix?: string;
      identifier?: string;
      customName?: string;
    } = {},
  ): Promise<string> {
    this.checkConfiguration();

    let fileName: string | undefined;
    try {
      const timestamp = Date.now();
      const randomSuffix = Math.round(Math.random() * 1e9);
      const fileExt = file.originalname.split('.').pop();

      const {
        folder = 'images',
        prefix = 'img',
        identifier = 'unknown',
        customName,
      } = options;

      if (customName) {
        const safeCustomName = encodeURIComponent(customName)
          .replace(/%/g, '_')
          .replace(/\s/g, '-')
          .toLowerCase();
        fileName = `${folder}/${safeCustomName}-${timestamp}-${randomSuffix}.${fileExt}`;
      } else {
        const cleanedIdentifier =
          identifier && identifier.trim() !== ''
            ? identifier.trim()
            : `user_${timestamp}`;

        const preCleanedIdentifier = cleanedIdentifier
          .replace(/'/g, '_')
          .replace(/"/g, '_')
          .replace(/#/g, '_')
          .replace(/\$/g, '_')
          .replace(/\(/g, '_')
          .replace(/\)/g, '_')
          .replace(/\[/g, '_')
          .replace(/\]/g, '_')
          .replace(/\{/g, '_')
          .replace(/\}/g, '_');

        const safeIdentifier = encodeURIComponent(preCleanedIdentifier)
          .replace(/%20/g, '_')
          .replace(/%/g, '_')
          .replace(/\s+/g, '-')
          .toLowerCase();

        fileName = `${folder}/${prefix}-${safeIdentifier}-${timestamp}-${randomSuffix}.${fileExt}`;
      }

      const uploadParams = {
        Bucket: this.bucketName,
        Key: fileName,
        Body: this.toStream(file.buffer),
        ContentType: file.mimetype,
        ContentLength: file.size,
      };

      const result = await this.obsClient.putObject(uploadParams);

      if (result.CommonMsg.Status < 300) {
        this.logger.log(`Image uploaded successfully: ${fileName}`);
        return fileName;
      } else {
        throw new Error(`Image upload failed: ${result.CommonMsg.Code}`);
      }
    } catch (error) {
      this.logger.error(
        `OBS image upload failed — folder=${options.folder ?? 'images'} key=${fileName ?? 'unknown'} mimetype=${file.mimetype} size=${file.size}bytes error=${(error as Error)?.message}`,
        (error as Error)?.stack,
      );
      throw error;
    }
  }

  /**
   * Delete file from OBS bucket
   *
   * @param fileName - OBS key (not full URL, extract key from URL first)
   * @returns Promise<boolean> - true if deleted successfully, false otherwise
   */
  async deleteFile(fileName: string): Promise<boolean> {
    this.checkConfiguration();

    try {
      const result = await this.obsClient.deleteObject({
        Bucket: this.bucketName,
        Key: fileName,
      });

      if (result.CommonMsg.Status < 300) {
        this.logger.log(`File deleted successfully: ${fileName}`);
        return true;
      } else {
        this.logger.warn(
          `OBS delete failed — key=${fileName} code=${result.CommonMsg.Code}`,
        );
        return false;
      }
    } catch (error) {
      this.logger.error(
        `OBS delete error — key=${fileName} error=${(error as Error)?.message}`,
        (error as Error)?.stack,
      );
      return false;
    }
  }

  /**
   * Generate public URL for OBS file
   * Converts OBS key to full public URL
   *
   * @param fileName - OBS key (e.g., 'folder/file.jpg')
   * @returns string - Full public OBS URL
   */
  generatePublicUrl(fileName: string): string {
    this.checkConfiguration();

    const domainName = this.config.get('OBS_DOMAIN_NAME');
    const encodedFileName = encodeURIComponent(fileName).replace(/%2F/g, '/');
    return `https://${domainName}/${encodedFileName}`;
  }

  /**
   * Generate presigned URL for temporary access to OBS file.
   * Respects CDN token auth and unsigned CDN rules when configured.
   *
   * @param fileName - OBS key (not full URL)
   * @param expiresInSeconds - Expiration time in seconds (default: OBS_SIGNED_URL_EXPIRES env or 300)
   * @returns Promise<string> - Presigned URL with temporary access
   */
  async generatePresignedUrl(
    fileName: string,
    expiresInSeconds: number = this.config.get('OBS_SIGNED_URL_EXPIRES'),
  ): Promise<string> {
    this.checkConfiguration();

    try {
      const cdnTokenUrl = this.generateCdnTokenUrl(fileName, expiresInSeconds);
      if (cdnTokenUrl) return cdnTokenUrl;

      if (this.shouldUseUnsignedCdnUrl(fileName)) {
        return this.generatePublicUrl(fileName);
      }

      const result = await this.obsClient.createSignedUrlSync({
        Bucket: this.bucketName,
        Key: fileName,
        Expires: expiresInSeconds,
        Method: 'GET',
      });
      return this.shouldReplaceSignedUrlHost()
        ? this.replaceWithCdnDomain(result.SignedUrl)
        : result.SignedUrl;
    } catch (error) {
      this.logger.error('Error generating presigned URL:', error);
      throw error;
    }
  }

  /**
   * Generate presigned URL synchronously using OBS temporary signature.
   * No network call is made — the signature is computed locally via HMAC.
   *
   * @param fileName - OBS key (not full URL)
   * @param expiresInSeconds - Expiration time in seconds (default: OBS_SIGNED_URL_EXPIRES env or 300)
   * @returns Presigned URL string
   */
  generatePresignedUrlSync(
    fileName: string,
    expiresInSeconds: number = this.config.get('OBS_SIGNED_URL_EXPIRES'),
  ): string {
    this.checkConfiguration();

    const cdnTokenUrl = this.generateCdnTokenUrl(fileName, expiresInSeconds);
    if (cdnTokenUrl) return cdnTokenUrl;

    if (this.shouldUseUnsignedCdnUrl(fileName)) {
      return this.generatePublicUrl(fileName);
    }

    const result = this.obsClient.createSignedUrlSync({
      Bucket: this.bucketName,
      Key: fileName,
      Expires: expiresInSeconds,
      Method: 'GET',
    });
    return this.shouldReplaceSignedUrlHost()
      ? this.replaceWithCdnDomain(result.SignedUrl)
      : result.SignedUrl;
  }

  // ── CDN helpers ──

  private shouldUseUnsignedCdnUrl(fileName: string): boolean {
    const domainName = this.config.get('OBS_DOMAIN_NAME')?.trim().toLowerCase();
    if (!domainName) return false;
    return (
      this.isCustomCdnDomain(domainName) && this.isPublicCdnAsset(fileName)
    );
  }

  private isCustomCdnDomain(domainName: string): boolean {
    const endpoint = this.config.get('OBS_ENDPOINT')?.trim().toLowerCase();
    const isObsEndpoint =
      domainName.includes('.obs.') ||
      (!!endpoint &&
        (domainName === endpoint || domainName.endsWith(`.${endpoint}`)));
    return !isObsEndpoint;
  }

  private isPublicCdnAsset(fileName: string): boolean {
    const normalizedFileName = this.normalizeFileName(fileName);
    return this.getUnsignedCdnPublicPrefixes().some((prefix) =>
      normalizedFileName.startsWith(prefix),
    );
  }

  private getUnsignedCdnPublicPrefixes(): string[] {
    const envValue = this.config.get('CDN_UNSIGNED_PUBLIC_PREFIXES');
    if (!envValue) return this.defaultUnsignedCdnPublicPrefixes;
    return envValue
      .split(/[;,]/)
      .map((p) => p.trim().replace(/^\/+/, ''))
      .filter(Boolean);
  }

  private generateCdnTokenUrl(
    fileName: string,
    expiresInSeconds: number,
  ): string | null {
    const domainName = this.config.get('OBS_DOMAIN_NAME')?.trim().toLowerCase();
    if (!domainName || !this.isCustomCdnDomain(domainName)) return null;
    if (!this.isCdnTokenAuthEnabled()) return null;
    if (!this.isCdnTokenProtectedAsset(fileName)) return null;

    const signingKey = this.config.get('CDN_TOKEN_AUTH_KEY')?.trim();
    if (!signingKey) return null;

    const authParam =
      this.config.get('CDN_TOKEN_AUTH_PARAM')?.trim() || 'auth_key';
    const algorithm = this.getCdnTokenAlgorithm();
    const timestamp = Math.floor(Date.now() / 1000) + expiresInSeconds;
    const rand = '0';
    const uid = '0';
    const encodedFileName = encodeURIComponent(
      this.normalizeFileName(fileName),
    ).replace(/%2F/g, '/');
    const accessPath = `/${encodedFileName}`;
    const hashInput = `${accessPath}-${timestamp}-${rand}-${uid}-${signingKey}`;
    const hash = createHash(algorithm).update(hashInput).digest('hex');
    const token = `${timestamp}-${rand}-${uid}-${hash}`;

    return `https://${domainName}${accessPath}?${authParam}=${token}`;
  }

  private isCdnTokenAuthEnabled(): boolean {
    return ['true', '1', 'yes'].includes(
      (this.config.get('CDN_TOKEN_AUTH_ENABLED') ?? '').trim().toLowerCase(),
    );
  }

  private getCdnTokenAlgorithm(): 'md5' | 'sha256' {
    return this.config.get('CDN_TOKEN_AUTH_ALGORITHM')?.trim().toLowerCase() ===
      'md5'
      ? 'md5'
      : 'sha256';
  }

  private isCdnTokenProtectedAsset(fileName: string): boolean {
    const normalizedFileName = this.normalizeFileName(fileName);
    return (
      this.getCdnTokenProtectedPrefixes().some((prefix) =>
        normalizedFileName.startsWith(prefix),
      ) || this.hasCdnTokenProtectedExtension(normalizedFileName)
    );
  }

  private getCdnTokenProtectedPrefixes(): string[] {
    const envValue = this.config.get('CDN_TOKEN_PROTECTED_PREFIXES');
    if (!envValue) return this.defaultCdnTokenProtectedPrefixes;
    return envValue
      .split(/[;,]/)
      .map((p) => p.trim().replace(/^\/+/, ''))
      .filter(Boolean);
  }

  private hasCdnTokenProtectedExtension(fileName: string): boolean {
    const lowerFileName = fileName.toLowerCase();
    return this.getCdnTokenProtectedExtensions().some((ext) =>
      lowerFileName.endsWith(ext),
    );
  }

  private getCdnTokenProtectedExtensions(): string[] {
    const envValue = this.config.get('CDN_TOKEN_PROTECTED_EXTENSIONS');
    const values = envValue
      ? envValue.split(/[;,]/)
      : this.defaultCdnTokenProtectedExtensions;
    return values
      .map((ext) => ext.trim().toLowerCase())
      .filter(Boolean)
      .map((ext) => (ext.startsWith('.') ? ext : `.${ext}`));
  }

  private shouldReplaceSignedUrlHost(): boolean {
    const domainName = this.config.get('OBS_DOMAIN_NAME')?.trim().toLowerCase();
    if (!domainName) return false;
    return !this.isCustomCdnDomain(domainName);
  }

  private normalizeFileName(fileName: string): string {
    return fileName.replace(/^\/+/, '').split('?')[0];
  }

  private replaceWithCdnDomain(signedUrl: string): string {
    const cdnDomain = this.config.get('OBS_DOMAIN_NAME');
    if (!cdnDomain) return signedUrl;
    return signedUrl.replace(
      /^https?:\/\/[^/?#]+(:\d+)?/,
      `https://${cdnDomain}`,
    );
  }

  // ── File existence ──

  /**
   * Check if file exists in OBS bucket
   *
   * @param fileName - OBS key (not full URL)
   * @returns Promise<boolean> - true if file exists, false otherwise
   */
  async fileExists(fileName: string): Promise<boolean> {
    this.checkConfiguration();

    try {
      const result = await this.obsClient.getObjectMetadata({
        Bucket: this.bucketName,
        Key: fileName,
      });
      return result.CommonMsg.Status < 300;
    } catch {
      return false;
    }
  }

  // ── Multipart upload (chunked upload support) ──

  /**
   * Generate a safe, unique OBS object key for a file.
   *
   * @param folder - Target folder/prefix
   * @param filename - Original filename (used for extension)
   * @param identifier - Optional human-readable identifier embedded in the key
   * @returns OBS key string
   */
  generateObjectKey(
    folder: string,
    filename: string,
    identifier?: string,
  ): string {
    const timestamp = Date.now();
    const randomSuffix = Math.round(Math.random() * 1e9);
    const fileExt = filename.split('.').pop() || 'mp4';

    if (identifier) {
      const safeId = identifier
        .replace(/[^a-z0-9-_]/gi, '-')
        .toLowerCase()
        .substring(0, 50);
      return `${folder}/file-${safeId}-${timestamp}.${fileExt}`;
    }
    return `${folder}/file-${timestamp}-${randomSuffix}.${fileExt}`;
  }

  async initiateMultipartUpload(
    key: string,
    contentType: string,
  ): Promise<string> {
    this.checkConfiguration();

    const result = await this.obsClient.initiateMultipartUpload({
      Bucket: this.bucketName,
      Key: key,
      ContentType: contentType,
      ACL: this.obsClient.enums.AclPublicRead,
    });

    if (result.CommonMsg.Status < 300) {
      this.logger.log(`Multipart upload initiated: ${key}`);
      return result.InterfaceResult.UploadId;
    }
    this.logger.error(
      `OBS multipart initiate failed — key=${key} mimetype=${contentType} code=${result.CommonMsg.Code}`,
    );
    throw new Error(
      `Failed to initiate multipart upload: ${result.CommonMsg.Code}`,
    );
  }

  async uploadPart(
    key: string,
    uploadId: string,
    partNumber: number,
    buffer: Buffer,
  ): Promise<string> {
    this.checkConfiguration();

    const result = await this.obsClient.uploadPart({
      Bucket: this.bucketName,
      Key: key,
      UploadId: uploadId,
      PartNumber: partNumber,
      Body: this.toStream(buffer),
      PartSize: buffer.length,
    });

    if (result.CommonMsg.Status < 300) {
      return result.InterfaceResult.ETag;
    }
    throw new Error(
      `Failed to upload part ${partNumber}: ${result.CommonMsg.Code}`,
    );
  }

  async completeMultipartUpload(
    key: string,
    uploadId: string,
    parts: Array<{ PartNumber: number; ETag: string }>,
  ): Promise<void> {
    this.checkConfiguration();

    const result = await this.obsClient.completeMultipartUpload({
      Bucket: this.bucketName,
      Key: key,
      UploadId: uploadId,
      Parts: parts,
    });

    if (result.CommonMsg.Status >= 300) {
      this.logger.error(
        `OBS multipart complete failed — key=${key} uploadId=${uploadId} parts=${parts.length} code=${result.CommonMsg.Code}`,
      );
      throw new Error(
        `Failed to complete multipart upload: ${result.CommonMsg.Code}`,
      );
    }
    this.logger.log(`Multipart upload completed: ${key}`);
  }

  async abortMultipartUpload(key: string, uploadId: string): Promise<void> {
    this.checkConfiguration();

    await this.obsClient.abortMultipartUpload({
      Bucket: this.bucketName,
      Key: key,
      UploadId: uploadId,
    });
    this.logger.log(`Multipart upload aborted: ${key}`);
  }

  /**
   * Retrieve an OBS object as a readable stream.
   * Useful for proxying large files without buffering the entire body.
   *
   * @param key - OBS object key
   * @returns Readable stream of the object content
   */
  async getObjectStream(key: string): Promise<NodeJS.ReadableStream> {
    this.checkConfiguration();

    return new Promise((resolve, reject) => {
      this.obsClient.getObject(
        { Bucket: this.bucketName, Key: key, SaveAsStream: true },
        (err: any, result: any) => {
          if (err) {
            return reject(
              new Error(`OBS getObject failed: ${err.message ?? err}`),
            );
          }
          const status = result?.CommonMsg?.Status;
          if (status === 404) {
            const notFound = new Error(`OBS object not found: ${key}`) as any;
            notFound.obsStatusCode = 404;
            return reject(notFound);
          }
          if (status >= 300) {
            return reject(
              new Error(
                `OBS getObject error: ${result.CommonMsg.Code} (${status})`,
              ),
            );
          }
          const stream = result?.InterfaceResult?.Content;
          if (!stream) {
            return reject(
              new Error(`OBS getObject returned no stream for key: ${key}`),
            );
          }
          this.logger.log(`OBS stream opened: ${key}`);
          resolve(stream as NodeJS.ReadableStream);
        },
      );
    });
  }
}
