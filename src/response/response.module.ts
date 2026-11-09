import { Module } from '@nestjs/common';
import { ResponseController } from './response.controller';

@Module({
  controllers: [ResponseController],
  providers: [],
})
export class ResponseModule {}
