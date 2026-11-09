import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { HelperService } from 'src/utils/helper.service';
import { MailRelayModule } from 'src/mail-relay/mail-relay.module';

@Module({
  controllers: [AuthController],
  providers: [AuthService, HelperService],
  imports: [MailRelayModule],
})
export class AdminAuthModule {}
