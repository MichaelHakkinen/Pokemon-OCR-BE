import { Module } from '@nestjs/common';
import { FAQController } from './faq.controller';
import { FAQService } from './faq.service';
import { HelperService } from 'src/utils/helper.service';

@Module({
  controllers: [FAQController],
  providers: [FAQService, HelperService],
})
export class FAQModule {}
