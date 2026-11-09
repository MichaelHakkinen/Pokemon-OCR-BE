import { Module } from '@nestjs/common';
import { AdminGroupController } from './admin-group.controller';
import { AdminGroupService } from './admin-group.service';
import { HelperService } from 'src/utils/helper.service';

@Module({
  controllers: [AdminGroupController],
  providers: [AdminGroupService, HelperService],
})
export class AdminGroupModule {}
