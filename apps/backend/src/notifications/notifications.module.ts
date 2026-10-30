import { Logger, Module, OnModuleInit } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { AmazonSchedulerClientFactory } from './awsScheduler.factory';
import { VolunteersModule } from '../volunteers/volunteers.module';
import { AWSSESModule } from '../aws/ses/email.module';
import { getMissingEnvVars } from '../utils/env';

// Env vars needed only to schedule a notification for a future time. Sending one
// immediately needs none of these, just the SES config the AWSSESModule checks.
// AWS_REGION and the credentials are the shared AWS ones (also used by S3 and SES).
const REQUIRED_ENV_VARS_FOR_SCHEDULING = [
  'AWS_REGION',
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'AWS_NOTIFICATION_DISPATCH_LAMBDA_ARN',
  'AWS_SCHEDULER_ROLE_ARN',
  'NOTIFICATIONS_DISPATCH_SECRET',
] as const;

@Module({
  imports: [VolunteersModule, AWSSESModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, AmazonSchedulerClientFactory],
})
export class NotificationsModule implements OnModuleInit {
  private readonly logger = new Logger(NotificationsModule.name);

  /**
   * Reports at startup whether scheduled notifications are usable.
   *
   * There is no enabled flag: having the vars set is what turns scheduling on. This
   * surfaces a half-configured environment in the boot log rather than as a 500 the
   * first time a coordinator picks a send time.
   */
  onModuleInit(): void {
    const missing = getMissingEnvVars(REQUIRED_ENV_VARS_FOR_SCHEDULING);

    if (missing.length === 0) {
      this.logger.log('Scheduled notifications enabled');
      return;
    }

    this.logger.log(
      `Scheduled notifications disabled: missing env vars (${missing.join(
        ', ',
      )}). Immediate sends still work; POST /notifications with a sendAt will fail.`,
    );
  }
}
