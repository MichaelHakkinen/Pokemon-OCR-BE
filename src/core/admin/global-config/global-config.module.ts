import { Module } from '@nestjs/common';
import { HelperService } from 'src/utils/helper.service';
import { GlobalConfigController } from './global-config.controller';
import { GlobalConfigService } from './global-config.service';

@Module({
  controllers: [GlobalConfigController],
  providers: [GlobalConfigService, HelperService],
})
export class GlobalConfigModule {}
