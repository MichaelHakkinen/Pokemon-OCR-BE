import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { StorageService } from './storage.service';
import { S3Service } from './s3.service';
import { ObsService } from './obs.service';
import { ChunkUploadService } from './chunk-upload.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [StorageService, S3Service, ObsService, ChunkUploadService],
  exports: [StorageService, S3Service, ObsService, ChunkUploadService],
})
export class StorageModule {}
