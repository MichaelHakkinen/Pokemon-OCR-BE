import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';

// Scheduled jobs. Loaded only when EXECUTE_CRON=true (see app.module.ts), so
// with several replicas exactly one runs them. Add task modules here, e.g.:
//   import { CleanupTaskModule } from './cleanup-task/cleanup-task.module';
@Module({
  imports: [ScheduleModule.forRoot()],
})
export class CronModule {}
