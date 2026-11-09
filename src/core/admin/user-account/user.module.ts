import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { HelperService } from 'src/utils/helper.service';

@Module({
  controllers: [UserController],
  providers: [UserService, HelperService],
})
export class UserModule {}
