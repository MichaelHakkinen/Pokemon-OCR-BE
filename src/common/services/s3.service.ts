/**
 * Service to handle AWS S3 file operations
 * Requires AWS SDK v3
 * Make sure to set the following environment variables:
 * # AWS S3 Configuration
 * AWS_REGION=ap-southeast-1
 * AWS_ACCESS_KEY_ID=your-access-key-id
 * AWS_SECRET_ACCESS_KEY=your-secret-access-key
 * AWS_S3_BUCKET_NAME=your-s3-bucket-name
 */

import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class S3Service {
  private s3Client: S3Client;
  private bucketName: string;

  constructor(private configService: ConfigService) {
    this.s3Client = new S3Client({
      region: this.configService.get('AWS_REGION'),
      credentials: {
        accessKeyId: this.configService.get('AWS_ACCESS_KEY_ID'),
        secretAccessKey: this.configService.get('AWS_SECRET_ACCESS_KEY'),
      },
    });
    this.bucketName = this.configService.get('AWS_S3_BUCKET_NAME');
  }

  /**
   * Upload file to AWS S3 bucket
   *
   * @param file - The file to upload (from multer)
   * @param folder - S3 folder/prefix (default: 'uploads')
   * @param identifier - Unique identifier for the file
   * @param customFileName - Optional custom filename without extension
   *
   * @returns Promise<string> - Full S3 URL of uploaded file
   *
   * @example
   * const avatarUrl = await this.s3Service.uploadFile(
   *   avatar,
   *   'avatar-admin',
   *   `${Date.now()}-${adminDto.fullname}`,
   *   `admin-${adminDto.id}`
   * );
   * // Returns: 'https://bucket.s3.region.amazonaws.com/avatar-admin/admin-123.jpg'
   */
  async uploadFile(
    file: Express.Multer.File,
    folder: string = 'uploads',
    identifier: string,
    customFileName?: string,
  ): Promise<string> {
    try {
      const fileExt = file.originalname.split('.').pop();
      const fileName = customFileName
        ? `${customFileName}.${fileExt}`
        : `${identifier}.${fileExt}`;

      const key = `${folder}/${fileName}`;

      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      });

      await this.s3Client.send(command);

      const url = `https://${this.bucketName}.s3.${this.configService.get('AWS_REGION')}.amazonaws.com/${key}`;

      return url;
    } catch (error) {
      throw new BadRequestException(`Failed to upload file: ${error.message}`);
    }
  }

  /**
   * Generate S3 key from folder, identifier, and extension
   *
   * @param folder - S3 folder/prefix
   * @param identifier - File identifier
   * @param extension - File extension (default: 'jpg')
   *
   * @returns string - S3 key in format: 'folder/identifier.extension'
   *
   * @example
   * const key = this.s3Service.generateKey('avatars', 'user-123', 'png');
   * // Returns: 'avatars/user-123.png'
   */
  generateKey(
    folder: string,
    identifier: string,
    extension: string = 'jpg',
  ): string {
    return `${folder}/${identifier}.${extension}`;
  }

  /**
   * Extract S3 key from full S3 URL
   *
   * @param url - Full S3 URL
   *
   * @returns string - S3 key (path after bucket domain)
   *
   * @example
   * const key = this.s3Service.extractKeyFromUrl(
   *   'https://bucket.s3.region.amazonaws.com/folder/file.jpg'
   * );
   * // Returns: 'folder/file.jpg'
   */
  extractKeyFromUrl(url: string): string {
    const urlParts = url.split('.amazonaws.com/');
    return urlParts[1] || '';
  }

  /**
   * Delete file from S3 by URL
   *
   * @param url - Full S3 URL of the file to delete
   *
   * @returns Promise<void>
   *
   * @throws BadRequestException if URL is invalid or deletion fails
   *
   * @example
   * await this.s3Service.deleteFileByUrl(
   *   'https://bucket.s3.region.amazonaws.com/avatars/user-123.jpg'
   * );
   */
  async deleteFileByUrl(url: string): Promise<void> {
    try {
      const key = this.extractKeyFromUrl(url);
      if (!key) {
        throw new BadRequestException('Invalid S3 URL provided');
      }

      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);
    } catch (error) {
      throw new BadRequestException(`Failed to delete file: ${error.message}`);
    }
  }

  /**
   * Generate presigned URL for temporary access to S3 file
   *
   * @param url - Full S3 URL
   * @param expiresIn - Expiration time in seconds (default: 3600 = 1 hour)
   *
   * @returns Promise<string> - Presigned URL with temporary access
   *
   * @throws BadRequestException if URL is invalid or generation fails
   *
   * @example
   * // Generate 1-hour presigned URL
   * const signedUrl = await this.s3Service.getSignedUrlByUrl(
   *   'https://bucket.s3.region.amazonaws.com/private/document.pdf'
   * );
   *
   * @example
   * // Generate 24-hour presigned URL
   * const signedUrl = await this.s3Service.getSignedUrlByUrl(
   *   fileUrl,
   *   86400
   * );
   */
  async getSignedUrlByUrl(
    url: string,
    expiresIn: number = 3600,
  ): Promise<string> {
    try {
      const key = this.extractKeyFromUrl(url);
      if (!key) {
        throw new BadRequestException('Invalid S3 URL provided');
      }

      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      return await getSignedUrl(this.s3Client, command, { expiresIn });
    } catch (error) {
      throw new BadRequestException(
        `Failed to generate signed URL: ${error.message}`,
      );
    }
  }

  /**
   * Generate public URL from S3 key
   *
   * @param key - S3 key (e.g., 'folder/file.jpg')
   *
   * @returns string - Full public S3 URL
   *
   * @example
   * const url = this.s3Service.getPublicUrl('avatars/user-123.jpg');
   * // Returns: 'https://bucket.s3.region.amazonaws.com/avatars/user-123.jpg'
   */
  getPublicUrl(key: string): string {
    return `https://${this.bucketName}.s3.${this.configService.get('AWS_REGION')}.amazonaws.com/${key}`;
  }
}
