import { Logger, Module, OnModuleInit } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { AmazonSchedulerClientFactory } from './awsScheduler.factory';
import { VolunteersModule } from '../volunteers/volunteers.module';
import { AWSSESModule } from '../aws/ses/email.module';
import { getMissingEnvVars } from '../utils/env';

// Env vars notifications need to send and schedule. AWS_REGION and the credentials
// are the shared AWS ones (also used by S3 and SES).
const REQUIRED_ENV_VARS = [
  'AWS_REGION',
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'AWS_SES_SENDER_EMAIL',
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
   * Checks at startup that every env var notifications need is set.
   *
   * Notifications are always enabled, so a missing var fails the boot rather than
   * surfacing as a 500 the first time a coordinator sends a notification.
   *
   * @throws {Error} If any required env var is missing or blank.
   */
  onModuleInit(): void {
    const missing = getMissingEnvVars(REQUIRED_ENV_VARS);

    if (missing.length > 0) {
      throw new Error(
        `Notifications misconfigured: missing env vars (${missing.join(', ')})`,
      );
    }

    this.logger.log('Notifications enabled');
  }
}
