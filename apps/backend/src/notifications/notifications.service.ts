import {
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { isEmail } from 'class-validator';
import {
  ActionAfterCompletion,
  CreateScheduleCommand,
  FlexibleTimeWindowMode,
  SchedulerClient,
} from '@aws-sdk/client-scheduler';
import { EmailsService } from '../aws/ses/email.service';
import { VolunteersService } from '../volunteers/volunteers.service';
import { CreateBulkNotificationDto } from './dtos/create-bulk-notification.dto';
import { AMAZON_SCHEDULER_CLIENT } from './awsScheduler.factory';

// SES caps a message at 50 recipients across To, Cc and Bcc combined, and the
// sender always occupies the To slot, so only 49 are left for Bcc.
const BCC_BATCH_SIZE = 49;

// Mirrors SendEmailDTO's @Length(1, 255) on each Bcc address.
const MAX_EMAIL_LENGTH = 255;

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private volunteersService: VolunteersService,
    private emailsService: EmailsService,
    @Inject(AMAZON_SCHEDULER_CLIENT)
    private readonly scheduler: SchedulerClient,
  ) {}

  /**
   * Sends a bulk notification immediately, or schedules it when sendAt is set.
   *
   * @param dto - The subject, HTML body, foster type filters, and optional send time.
   * @throws {InternalServerErrorException} If the AWS configuration needed for the
   *   chosen path is missing.
   */
  async createBulkNotification(dto: CreateBulkNotificationDto): Promise<void> {
    if (dto.sendAt) {
      return this.schedule(dto, dto.sendAt);
    }

    return this.sendNow(dto);
  }

  /**
   * Hands the notification to EventBridge Scheduler, which invokes the dispatch
   * Lambda at `sendAt`.
   *
   * The notification itself is stored in the schedule's payload rather than in our
   * database, and the schedule deletes itself once it has fired. Only the filters
   * are stored, never the resolved recipients, so Volunteers whose status changed before
   * `sendAt` are correctly left out when the dispatch actually runs.
   *
   * @param content - The subject, HTML body, and foster type filters.
   * @param sendAt - When the notification should go out.
   * @throws {InternalServerErrorException} If the Scheduler target or role is not configured.
   */
  private async schedule(
    content: CreateBulkNotificationDto,
    sendAt: Date,
  ): Promise<void> {
    const targetArn = process.env.AWS_NOTIFICATION_DISPATCH_LAMBDA_ARN;
    const roleArn = process.env.AWS_SCHEDULER_ROLE_ARN;

    if (!targetArn || !roleArn) {
      throw new InternalServerErrorException(
        'Scheduled notifications are not configured on this environment',
      );
    }

    await this.scheduler.send(
      new CreateScheduleCommand({
        Name: `notification-${randomUUID()}`,
        // at() rejects the trailing Z and the milliseconds that toISOString() emits.
        ScheduleExpression: `at(${sendAt.toISOString().slice(0, 19)})`,
        ScheduleExpressionTimezone: 'UTC',
        FlexibleTimeWindow: { Mode: FlexibleTimeWindowMode.OFF },
        ActionAfterCompletion: ActionAfterCompletion.DELETE,
        Target: {
          Arn: targetArn,
          RoleArn: roleArn,
          // Scheduler's default retries run up to 185 times over 24 hours. Three
          // attempts in ten minutes rides out a blip without hammering the dispatch
          // route all day when the configuration is simply wrong.
          RetryPolicy: {
            MaximumRetryAttempts: 2,
            MaximumEventAgeInSeconds: 600,
          },
          Input: JSON.stringify({
            subject: content.subject,
            body: content.body,
            filters: content.filters ?? [],
          }),
        },
      }),
    );
  }

  /**
   * Emails every active Volunteer whose foster type is one of `content.filters`,
   * or every active Volunteer when no filters are given.
   *
   * Recipients are Bcc'd in batches of 49 so they can't see each other, with the
   * SES sender address in the To slot. A batch that fails to send is logged and
   * the remaining batches are still attempted, so one bad address can't stop the
   * rest of the send.
   *
   * @param content - The subject, HTML body, and foster type filters.
   * @throws {InternalServerErrorException} If AWS_SES_SENDER_EMAIL is not configured.
   */
  async sendNow(content: CreateBulkNotificationDto): Promise<void> {
    const sender = process.env.AWS_SES_SENDER_EMAIL;
    if (!sender) {
      throw new InternalServerErrorException(
        'AWS_SES_SENDER_EMAIL is not configured',
      );
    }

    const volunteers = await this.volunteersService.findActiveByFosterTypes(
      content.filters ?? [],
    );
    // SendEmailDTO validates every Bcc address, so a duplicate (@ArrayUnique) or a
    // malformed address (@IsEmail) would fail its whole batch. Drop them up front.
    const unique = [
      ...new Set(volunteers.map((v) => v.email.trim().toLowerCase())),
    ];
    const recipients = unique.filter(
      (email) => isEmail(email) && email.length <= MAX_EMAIL_LENGTH,
    );
    if (recipients.length < unique.length) {
      this.logger.warn(
        `Skipped ${
          unique.length - recipients.length
        } Volunteer(s) with an invalid email address`,
      );
    }

    if (recipients.length === 0) {
      this.logger.warn(
        'No active Volunteers matched the notification filters. Nothing sent.',
      );
      return;
    }

    let failed = 0;
    for (let i = 0; i < recipients.length; i += BCC_BATCH_SIZE) {
      const batch = recipients.slice(i, i + BCC_BATCH_SIZE);

      try {
        await this.emailsService.sendEmail({
          toEmail: sender,
          subject: content.subject,
          bodyHtml: content.body,
          bccEmails: batch,
        });
      } catch (err) {
        failed += batch.length;
        this.logger.error(
          `Bulk notification failed for ${batch.length} recipient(s)`,
          err instanceof Error ? err.stack : String(err),
        );
      }
    }

    // TODO: implement retry mechanism for failed email sends
    // failed batches are logged & never retried, caller still gets 202
    if (failed > 0) {
      this.logger.warn(
        `Bulk notification partially sent: ${failed} of ${recipients.length} recipient(s) not emailed`,
      );
    }
  }
}
