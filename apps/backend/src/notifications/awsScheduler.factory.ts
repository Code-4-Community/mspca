import { Provider } from '@nestjs/common';
import { SchedulerClient } from '@aws-sdk/client-scheduler';

export const AMAZON_SCHEDULER_CLIENT = 'AMAZON_SCHEDULER_CLIENT';

/**
 * Factory that produces a new instance of the EventBridge Scheduler client.
 * Reads region and credentials from process.env at injection time and
 * passes them explicitly to the client, matching the SES client factory.
 *
 * Unlike that factory there is no disabled branch returning a dummy client: the
 * empty-string fallbacks already make this constructible with no AWS config, and
 * NotificationsService rejects a scheduled send before touching the client when
 * the target and role ARNs are unset.
 */
export const AmazonSchedulerClientFactory: Provider<SchedulerClient> = {
  provide: AMAZON_SCHEDULER_CLIENT,
  useFactory: () =>
    new SchedulerClient({
      region: process.env.AWS_REGION ?? '',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? '',
      },
    }),
};
