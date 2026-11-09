import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma';

// The app's single database client, provided through DI so services can be
// unit-tested with a mock instead of a live database.
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnApplicationShutdown
{
  constructor(config: ConfigService) {
    super({
      adapter: new PrismaPg({
        connectionString: config.getOrThrow<string>('DATABASE_URL'),
      }),
    });
  }

  // Last shutdown phase: onModuleDestroy hooks (e.g. auth draining queued
  // OTP emails) still need the database.
  async onApplicationShutdown() {
    await this.$disconnect();
  }
}
