import { Logger, Module, OnModuleInit } from '@nestjs/common';
import { EmailsService } from './email.service';
import { AmazonSESWrapper } from './awsSes.wrapper';
import { AmazonSESClientFactory } from './awsSesClient.factory';
import { getMissingEnvVars } from '../../utils/env';

// Env vars required only when SES dispatch is enabled (SES_ENABLED === 'true').
// AWS_REGION and the credentials are the shared AWS ones (also used by the S3 module);
// only AWS_SES_SENDER_EMAIL is specific to SES.
const REQUIRED_ENV_VARS_WHEN_ENABLED = [
  'AWS_REGION',
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'AWS_SES_SENDER_EMAIL',
] as const;

@Module({
  providers: [AmazonSESWrapper, AmazonSESClientFactory, EmailsService],
  exports: [EmailsService],
})
export class AWSSESModule implements OnModuleInit {
  private readonly logger = new Logger(AWSSESModule.name);

  onModuleInit(): void {
    // Email sending is disabled: skip validation so teams not using SES can
    // boot without any AWS config.
    if (process.env.SES_ENABLED?.toLowerCase() !== 'true') {
      this.logger.log(
        'SES disabled: SES_ENABLED is not "true". No emails will be sent.',
      );
      return;
    }

    const missing = getMissingEnvVars(REQUIRED_ENV_VARS_WHEN_ENABLED);

    if (missing.length > 0) {
      throw new Error(
        `SES enabled but not fully configured: missing env vars (${missing.join(
          ', ',
        )}).`,
      );
    }

    this.logger.log('SES enabled');
  }
}
