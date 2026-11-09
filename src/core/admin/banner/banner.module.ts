import { Module } from '@nestjs/common';
import { HelperService } from 'src/utils/helper.service';
import { StorageModule } from 'src/common/services/storage.module';
import { BannerController } from './banner.controller';
import { BannerService } from './banner.service';

@Module({
  imports: [StorageModule],
  controllers: [BannerController],
  providers: [BannerService, HelperService],
})
export class BannerModule {}
