import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { ObsService } from './obs.service';
import { RedisService } from './redis.service';

interface ChunkPart {
  partNumber: number;
  etag: string;
}

export interface ChunkUploadSession {
  folder: string;
  key: string;
  obsUploadId: string | null;
  mimetype: string;
  originalname: string;
  totalChunks: number;
  parts: ChunkPart[];
  createdAt: number;
  storageType: string;
  status: 'uploading' | 'completing' | 'completed';
  finalUrl?: string;
}

export interface InitiateChunkOptions {
  folder: string;
  filename: string;
  mimetype: string;
  totalChunks: number;
  identifier?: string;
}

@Injectable()
export class ChunkUploadService implements OnModuleInit {
  private readonly logger = new Logger(ChunkUploadService.name);
  private readonly CHUNK_TTL_SECONDS = 86400; // 24 h while upload is in progress
  private readonly SHADOW_TTL_SECONDS = 86400 + 3600; // 25 h — 1 h longer than the session key
  private readonly COMPLETED_TTL_SECONDS = 3600; // 1 h after complete, waiting for record creation
  private readonly SESSION_KEY_PREFIX = 'chunk:upload:';
  private readonly SHADOW_KEY_PREFIX = 'chunk:upload:shadow:';
  private readonly TEMP_DIR: string;

  constructor(
    private readonly redisService: RedisService,
    private readonly obsService: ObsService,
    private readonly configService: ConfigService,
  ) {
    this.TEMP_DIR = path.join(process.cwd(), 'src', 'public', 'temp');
  }

  async onModuleInit() {
    try {
      await this.redisService.onKeyExpired((expiredKey) => {
        if (
          expiredKey.startsWith(this.SESSION_KEY_PREFIX) &&
          !expiredKey.startsWith(this.SHADOW_KEY_PREFIX)
        ) {
          const uploadId = expiredKey.slice(this.SESSION_KEY_PREFIX.length);
          this.handleExpiredSession(uploadId).catch((err) =>
            this.logger.error(
              `Failed to cleanup expired session ${uploadId}: ${err.message}`,
            ),
          );
        }
      });
      this.logger.log(
        `Expiry listener is active for chunk upload cleanup (${this.redisService.mode})`,
      );
    } catch (err) {
      this.logger.warn(
        `Failed to set up Redis expiry listener: ${(err as Error).message}. ` +
          'OBS cleanup on session expiry will be handled by OBS Lifecycle Rules.',
      );
    }
  }

  private async handleExpiredSession(uploadId: string): Promise<void> {
    const shadowKey = this.shadowKey(uploadId);
    const shadow = await this.redisService.getJSON<{
      obsKey: string;
      obsUploadId: string;
    }>(shadowKey);

    if (!shadow) return;

    this.logger.log(
      `Session expired, aborting OBS multipart upload: ${uploadId}`,
    );
    try {
      await this.obsService.abortMultipartUpload(
        shadow.obsKey,
        shadow.obsUploadId,
      );
    } catch (err) {
      this.logger.warn(
        `Chunk upload session expired cleanup failed — uploadId=${uploadId} obsKey=${shadow.obsKey} error=${(err as Error).message}`,
      );
    } finally {
      await this.redisService.del(shadowKey);
    }
  }

  private sessionKey(uploadId: string): string {
    return `${this.SESSION_KEY_PREFIX}${uploadId}`;
  }

  private shadowKey(uploadId: string): string {
    return `${this.SHADOW_KEY_PREFIX}${uploadId}`;
  }

  // Parts stored in a separate Redis Hash: field=partNumber, value=etag.
  // Avoids re-serialising the full session JSON on every chunk upload.
  private partsKey(uploadId: string): string {
    return `${this.SESSION_KEY_PREFIX}parts:${uploadId}`;
  }

  /**
   * Initiate a new chunked upload session.
   *
   * @returns uploadId — pass to every subsequent uploadChunk / complete / abort call.
   * @returns maxChunkSize — maximum allowed size per chunk in bytes (5 MiB).
   */
  async initiate(
    options: InitiateChunkOptions,
  ): Promise<{ uploadId: string; maxChunkSize: number }> {
    const storageType = this.configService.get('DISK_STORAGE', 'local');
    const uploadId = randomUUID();

    let obsUploadId: string | null = null;
    let key: string;

    if (storageType === 'obs') {
      key = this.obsService.generateObjectKey(
        options.folder,
        options.filename,
        options.identifier,
      );
      obsUploadId = await this.obsService.initiateMultipartUpload(
        key,
        options.mimetype,
      );
    } else if (storageType === 'local') {
      const ext = options.filename.split('.').pop() || 'mp4';
      key = `${options.folder}/${uploadId}.${ext}`;
    } else {
      throw new BadRequestException(
        `Chunked upload is not yet supported for storage type: ${storageType}`,
      );
    }

    const session: ChunkUploadSession = {
      folder: options.folder,
      key,
      obsUploadId,
      mimetype: options.mimetype,
      originalname: options.filename,
      totalChunks: options.totalChunks,
      parts: [],
      createdAt: Date.now(),
      storageType,
      status: 'uploading',
    };

    try {
      await this.redisService.setJSON(
        this.sessionKey(uploadId),
        session,
        this.CHUNK_TTL_SECONDS,
      );

      // Shadow key (OBS only): stores the minimum data needed to abort the multipart
      // upload if the session key expires before the upload is completed.
      if (storageType === 'obs') {
        await this.redisService.setJSON(
          this.shadowKey(uploadId),
          { obsKey: key, obsUploadId },
          this.SHADOW_TTL_SECONDS,
        );
      }
    } catch (err) {
      await this.redisService
        .del(this.sessionKey(uploadId))
        .catch(() => undefined);
      if (storageType === 'obs' && obsUploadId) {
        await this.obsService
          .abortMultipartUpload(key, obsUploadId)
          .catch((abortErr) =>
            this.logger.error(
              `Failed to abort OBS multipart after Redis error on initiate ${uploadId}: ${(abortErr as Error).message}`,
            ),
          );
      }
      throw err;
    }

    this.logger.log(`Chunk upload initiated: ${uploadId} [${storageType}]`);
    return { uploadId, maxChunkSize: 5 * 1024 * 1024 };
  }

  /**
   * Upload a single chunk. Safe to retry — idempotent per chunkIndex.
   *
   * @param uploadId - Session ID from initiate()
   * @param chunkIndex - Zero-based chunk index
   * @param buffer - Raw chunk bytes
   */
  async uploadChunk(
    uploadId: string,
    chunkIndex: number,
    buffer: Buffer,
  ): Promise<{
    chunkIndex: number;
    uploadedParts: number;
    totalChunks: number;
    progress: number;
  }> {
    const session = await this.redisService.getJSON<ChunkUploadSession>(
      this.sessionKey(uploadId),
    );
    if (!session) {
      throw new NotFoundException('Upload session not found or expired');
    }

    if (session.status !== 'uploading') {
      throw new BadRequestException(
        `Cannot upload chunk: session is already in '${session.status}' state`,
      );
    }

    if (chunkIndex < 0 || chunkIndex >= session.totalChunks) {
      throw new BadRequestException(
        `Invalid chunkIndex ${chunkIndex}. Expected 0–${session.totalChunks - 1}`,
      );
    }

    const partNumber = chunkIndex + 1; // OBS parts are 1-based

    // Idempotent: skip if this part was already stored in the hash
    const alreadyUploaded = await this.redisService.hexists(
      this.partsKey(uploadId),
      String(partNumber),
    );
    if (alreadyUploaded) {
      const uploadedParts = await this.redisService.hlen(
        this.partsKey(uploadId),
      );
      return {
        chunkIndex,
        uploadedParts,
        totalChunks: session.totalChunks,
        progress: Math.round((uploadedParts / session.totalChunks) * 100),
      };
    }

    let etag: string;
    if (session.storageType === 'obs') {
      etag = await this.obsService.uploadPart(
        session.key,
        session.obsUploadId,
        partNumber,
        buffer,
      );
    } else {
      etag = await this.saveLocalChunk(uploadId, chunkIndex, buffer);
    }

    // HSETNX is atomic — safe under concurrent chunk uploads; naturally idempotent
    await this.redisService.hsetnx(
      this.partsKey(uploadId),
      String(partNumber),
      etag,
    );
    await this.redisService.expire(
      this.partsKey(uploadId),
      this.CHUNK_TTL_SECONDS,
    );

    const uploadedParts = await this.redisService.hlen(this.partsKey(uploadId));

    this.logger.log(
      `Chunk ${chunkIndex + 1}/${session.totalChunks} uploaded for ${uploadId}`,
    );

    return {
      chunkIndex,
      uploadedParts,
      totalChunks: session.totalChunks,
      progress: Math.round((uploadedParts / session.totalChunks) * 100),
    };
  }

  /**
   * Finalise the upload. All chunks must be uploaded first.
   * Idempotent — safe to retry if the client loses the response.
   *
   * @returns uploadId — use getCompletedUrl() or consumeCompletedSession() to retrieve the file URL.
   */
  async complete(uploadId: string): Promise<{ uploadId: string }> {
    const session = await this.redisService.getJSON<ChunkUploadSession>(
      this.sessionKey(uploadId),
    );
    if (!session) {
      throw new NotFoundException('Upload session not found or expired');
    }

    // Already fully completed — idempotent
    if (session.status === 'completed') {
      return { uploadId };
    }

    // 'completing' means OBS complete was called but Redis update failed.
    // Check if the file is already in storage to recover.
    if (session.status === 'completing') {
      return this.recoverCompletingSession(uploadId, session);
    }

    const partsHash = await this.redisService.hgetall(this.partsKey(uploadId));
    const uploadedCount = partsHash ? Object.keys(partsHash).length : 0;

    if (uploadedCount !== session.totalChunks) {
      throw new BadRequestException(
        `Upload incomplete: ${uploadedCount}/${session.totalChunks} chunks received`,
      );
    }

    const sortedParts = Object.entries(partsHash)
      .map(([partNumber, etag]) => ({
        partNumber: parseInt(partNumber, 10),
        etag,
      }))
      .sort((a, b) => a.partNumber - b.partNumber);

    // Compute the final URL before touching storage so it is deterministic.
    const url =
      session.storageType === 'obs'
        ? this.obsService.generatePresignedUrlSync(session.key)
        : `src/public/uploads/${session.key}`;

    // Mark 'completing' in Redis BEFORE calling OBS.
    // If the server crashes after OBS succeeds but before Redis updates,
    // the next retry will enter the 'completing' branch above and recover via fileExists.
    session.status = 'completing';
    session.finalUrl = url;
    await this.redisService.setJSON(
      this.sessionKey(uploadId),
      session,
      this.CHUNK_TTL_SECONDS,
    );

    if (session.storageType === 'obs') {
      await this.obsService.completeMultipartUpload(
        session.key,
        session.obsUploadId,
        sortedParts.map((p) => ({ PartNumber: p.partNumber, ETag: p.etag })),
      );
    } else {
      await this.assembleLocalChunks(uploadId, session);
    }

    session.status = 'completed';
    await this.redisService.setJSON(
      this.sessionKey(uploadId),
      session,
      this.COMPLETED_TTL_SECONDS,
    );
    await this.redisService.expire(
      this.partsKey(uploadId),
      this.COMPLETED_TTL_SECONDS,
    );
    await this.redisService.del(this.shadowKey(uploadId));

    this.logger.log(`Chunk upload completed: ${uploadId} → ${url}`);
    return { uploadId };
  }

  private async recoverCompletingSession(
    uploadId: string,
    session: ChunkUploadSession,
  ): Promise<{ uploadId: string }> {
    this.logger.warn(`Recovering completing session: ${uploadId}`);

    if (session.storageType === 'obs') {
      const exists = await this.obsService.fileExists(session.key);
      if (!exists) {
        await this.redisService.del(this.sessionKey(uploadId));
        throw new BadRequestException(
          'Upload failed during finalisation and cannot be recovered. Please start a new upload.',
        );
      }
    } else {
      const filename = session.key.split('/').pop();
      const finalPath = path.join(
        process.cwd(),
        'src',
        'public',
        'uploads',
        session.folder,
        filename,
      );
      if (!fs.existsSync(finalPath)) {
        await this.redisService.del(this.sessionKey(uploadId));
        throw new BadRequestException(
          'Upload failed during finalisation and cannot be recovered. Please start a new upload.',
        );
      }
    }

    session.status = 'completed';
    await this.redisService.setJSON(
      this.sessionKey(uploadId),
      session,
      this.COMPLETED_TTL_SECONDS,
    );
    await this.redisService.del(this.shadowKey(uploadId));

    this.logger.log(`Session recovered: ${uploadId}`);
    return { uploadId };
  }

  /**
   * Get the final file URL for a completed upload session.
   */
  async getCompletedUrl(uploadId: string): Promise<string> {
    const session = await this.redisService.getJSON<ChunkUploadSession>(
      this.sessionKey(uploadId),
    );
    if (!session) {
      throw new NotFoundException('Upload session not found or expired');
    }
    if (session.status !== 'completed') {
      throw new BadRequestException('Upload has not been completed yet');
    }
    return session.finalUrl;
  }

  /**
   * Get the final file URL and delete the session from Redis.
   * Call this after successfully creating the database record.
   */
  async consumeCompletedSession(uploadId: string): Promise<string> {
    const url = await this.getCompletedUrl(uploadId);
    await this.redisService.del(this.sessionKey(uploadId));
    await this.redisService.del(this.shadowKey(uploadId));
    await this.redisService.del(this.partsKey(uploadId));
    return url;
  }

  /**
   * Cancel an in-progress upload, abort OBS multipart, and clean up Redis keys.
   */
  async abort(uploadId: string): Promise<void> {
    const session = await this.redisService.getJSON<ChunkUploadSession>(
      this.sessionKey(uploadId),
    );
    if (!session) return;

    if (session.status === 'completing' || session.status === 'completed') {
      throw new BadRequestException(
        session.status === 'completing'
          ? 'Upload is currently being finalised and cannot be aborted.'
          : 'Cannot abort a completed upload. Delete the associated record instead.',
      );
    }

    if (session.storageType === 'obs' && session.obsUploadId) {
      try {
        await this.obsService.abortMultipartUpload(
          session.key,
          session.obsUploadId,
        );
      } catch (error) {
        this.logger.warn(
          `Failed to abort OBS multipart upload ${uploadId}: ${(error as Error).message}`,
        );
      }
    } else if (session.storageType === 'local') {
      this.cleanupLocalChunks(uploadId);
    }

    await this.redisService.del(this.sessionKey(uploadId));
    await this.redisService.del(this.shadowKey(uploadId));
    await this.redisService.del(this.partsKey(uploadId));

    this.logger.log(`Chunk upload aborted: ${uploadId}`);
  }

  /**
   * Get the current session state including all uploaded parts.
   * Returns null if the session does not exist or has expired.
   */
  async getSession(uploadId: string): Promise<ChunkUploadSession | null> {
    const session = await this.redisService.getJSON<ChunkUploadSession>(
      this.sessionKey(uploadId),
    );
    if (!session) return null;

    const partsHash = await this.redisService.hgetall(this.partsKey(uploadId));
    session.parts = partsHash
      ? Object.entries(partsHash).map(([partNumber, etag]) => ({
          partNumber: parseInt(partNumber, 10),
          etag,
        }))
      : [];

    return session;
  }

  // ── Local storage helpers ──

  private async saveLocalChunk(
    uploadId: string,
    chunkIndex: number,
    buffer: Buffer,
  ): Promise<string> {
    const tempDir = path.join(this.TEMP_DIR, uploadId);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    fs.writeFileSync(path.join(tempDir, `chunk-${chunkIndex}`), buffer);
    return `local-chunk-${chunkIndex}`;
  }

  private async assembleLocalChunks(
    uploadId: string,
    session: ChunkUploadSession,
  ): Promise<void> {
    const filename = session.key.split('/').pop();
    const uploadDir = path.join(
      process.cwd(),
      'src',
      'public',
      'uploads',
      session.folder,
    );
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const finalPath = path.join(uploadDir, filename);
    const writeStream = fs.createWriteStream(finalPath);
    const tempDir = path.join(this.TEMP_DIR, uploadId);

    for (let i = 0; i < session.totalChunks; i++) {
      const chunkBuffer = fs.readFileSync(path.join(tempDir, `chunk-${i}`));
      writeStream.write(chunkBuffer);
    }

    await new Promise<void>((resolve, reject) => {
      writeStream.end();
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });

    this.cleanupLocalChunks(uploadId);
  }

  private cleanupLocalChunks(uploadId: string): void {
    const tempDir = path.join(this.TEMP_DIR, uploadId);
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }
}
