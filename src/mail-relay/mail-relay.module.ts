import { Module } from '@nestjs/common';
import { MailRelayService } from './mail-relay.service';

@Module({
  controllers: [],
  providers: [MailRelayService],
  exports: [MailRelayService],
})
export class MailRelayModule {}
