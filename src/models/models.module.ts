import { Global, Module } from '@nestjs/common';
import { AdminModel } from './admin/AdminAccount.model';
import { AdminGroupModel } from './admin/AdminGroup.model';
import { BannerModel } from './admin/Banner.model';
import { FaqModel } from './admin/FAQ.model';
import { GlobalConfigModel } from './admin/GlobalConfig.model';
import { ModuleModel } from './admin/Module.model';
import { ModuleRuleModel } from './admin/ModuleRule.model';
import { OptionModel } from './admin/Option.model';
import { UserModel } from './user/UserAccount.model';
import { ErrorLogModel } from './ErrorLog.model';
import { MailRelayLogModel } from './MailRelayLog.model';

const MODELS = [
  AdminModel,
  AdminGroupModel,
  BannerModel,
  FaqModel,
  GlobalConfigModel,
  ModuleModel,
  ModuleRuleModel,
  OptionModel,
  UserModel,
  ErrorLogModel,
  MailRelayLogModel,
];

// Query classes over PrismaService, injectable anywhere without importing.
@Global()
@Module({
  providers: MODELS,
  exports: MODELS,
})
export class ModelsModule {}
