import { Module } from '@nestjs/common';
import { HelperService } from 'src/utils/helper.service';
import { ModuleRuleController } from './module-rule.controller';
import { ModuleRuleService } from './module-rule.service';

@Module({
  controllers: [ModuleRuleController],
  providers: [ModuleRuleService, HelperService],
})
export class ModuleRuleModule {}
