import { Module } from '@nestjs/common';
import { ModuleController } from './module.controller';
import { ModuleService } from './module.service';
import { HelperService } from 'src/utils/helper.service';

@Module({
  controllers: [ModuleController],
  providers: [ModuleService, HelperService],
})
export class ModuleModule {}
