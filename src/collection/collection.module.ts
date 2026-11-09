import { Module } from '@nestjs/common';
import { CollectionController } from './collection.controller';
import { CollectionService } from './collection.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { UserAuthGuard } from 'src/guards/UserAuth.guard';
import { CollectionUserGuard } from './collection-user.guard';

@Module({
  imports: [PrismaModule],
  controllers: [CollectionController],
  providers: [CollectionService, UserAuthGuard, CollectionUserGuard],
  exports: [CollectionService],
})
export class CollectionModule {}

