import { Module } from '@nestjs/common';
import { SchedulerService } from './scheduler.service';
import { AmazonSchedulerClientFactory } from './awsSchedulerClient.factory';

// No env check here: NotificationsModule, the only consumer, validates the AWS vars
// it needs at boot, and the client factory is constructible without them.
@Module({
  providers: [AmazonSchedulerClientFactory, SchedulerService],
  exports: [SchedulerService],
})
export class AWSSchedulerModule {}
