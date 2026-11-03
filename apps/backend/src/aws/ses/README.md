# SES Email Module

Thin wrapper around Amazon SES v2 for sending transactional emails (with optional attachments, cc, and bcc) from the backend. Validates input via `SendEmailDTO` and rate-limits sends. Each call delivers one email to a single primary recipient (`toEmail`), with cc visible in MIME headers and bcc hidden.

## Injecting `EmailsService`

`AWSSESModule` exports `EmailsService`, so any consuming module just needs to import `AWSSESModule` and then inject `EmailsService` through the constructor.

1. **Import `AWSSESModule`** in the consuming module:

   ```ts
   // users.module.ts
   import { AWSSESModule } from '../aws/ses/email.module';

   @Module({
     imports: [TypeOrmModule.forFeature([User]), AWSSESModule],
     controllers: [UsersController],
     providers: [UsersService],
   })
   export class UsersModule {}
   ```

2. **Inject `EmailsService`** through the constructor of any provider in that module:

   ```ts
   // users.service.ts
   import { EmailsService } from '../aws/ses/email.service';
   import { SendEmailDTO } from '../aws/ses/sendEmail.dto';

   @Injectable()
   export class UsersService {
     constructor(private emailsService: EmailsService) {}

     async notify(recipient: string) {
       const dto: SendEmailDTO = {
         toEmail: recipient,
         subject: 'Welcome',
         bodyHtml: '<p>Hi there.</p>',
       };
       return this.emailsService.sendEmail(dto);
     }
   }
   ```

`EmailsService.sendEmail` validates the DTO against its class-validator decorators on every call (since service-to-service calls bypass Nest's global `ValidationPipe`), so passing a plain object is fine — there's no need to call `plainToInstance` yourself.

## Verifying a sender identity in SES

`AmazonSESWrapper` sends every message `from` the address in `AWS_SES_SENDER_EMAIL`. SES will reject the send unless that address (or its domain) is a verified identity in the same AWS region as `AWS_REGION`.

To verify a sender:

1. Open the AWS console → **Amazon SES** → switch the region selector to match `AWS_REGION` (the module fails to boot if these don't agree).
2. **Identities** → **Create identity**.
3. Choose **Email address** (fastest for development) or **Domain** (required for production / sending from many addresses on the same domain).
4. Enter the address you set in `AWS_SES_SENDER_EMAIL` and create the identity.
5. AWS sends a confirmation link to that mailbox. Click it. The identity flips to **Verified** in the console.

If you swap `AWS_SES_SENDER_EMAIL` later, the new address must be verified separately — verification is per-identity, not per-account.

## `SES_ENABLED` flag

A boolean env var (`'true'` to enable, anything else — including unset — to disable) that gates real SES dispatch.

- When `SES_ENABLED === 'true'`: `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and `AWS_SES_SENDER_EMAIL` are checked at module initialization (`AWSSESModule.onModuleInit`), which throws listing any that are missing, so the app fails at startup instead of failing each send. `sendEmail` runs DTO validation, schedules the send through the rate limiter, then calls SES. Returns the `SendEmailCommandOutput` from SES (MessageId + metadata).
- When `SES_ENABLED` is unset or any other value: `sendEmail` still runs DTO validation (so a bad payload still throws), then logs a warning (`SES_ENABLED is not "true". Email not sent.`) and returns `void` without contacting SES. Neither `AWS_SES_SENDER_EMAIL` nor the AWS credentials need to be defined — teams not using SES can omit them entirely and the app still boots.
