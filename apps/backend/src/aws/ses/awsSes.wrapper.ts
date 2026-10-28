import { Inject, Injectable } from '@nestjs/common';
import {
  SESv2Client,
  SendEmailCommand,
  SendEmailCommandOutput,
} from '@aws-sdk/client-sesv2';
import MailComposer from 'nodemailer/lib/mail-composer';
import Mail from 'nodemailer/lib/mailer';
import { AMAZON_SES_CLIENT } from './awsSesClient.factory';
import { SendEmailDTO } from './sendEmail.dto';

@Injectable()
export class AmazonSESWrapper {
  /**
   * @param client SESv2 client from `awsSesClient.factory.ts`
   */
  constructor(
    @Inject(AMAZON_SES_CLIENT) private readonly client: SESv2Client,
  ) {}

  /**
   * Sends a single email via Amazon SES to `dto.toEmail`, with optional
   * `ccEmails` and `bccEmails`. Composes a MIME message (so attachments are
   * supported) and dispatches it via SendEmailCommand.
   *
   * @param dto the email payload
   * @returns the SES response, containing MessageId (SES's unique id for the sent message)
   * and metadata (HTTP status, AWS request id, retry counts)
   * @throws Error if MIME composition fails (bad attachment, oversized payload)
   * or if SES rejects the send (bad recipient, throttling, unverified sender, quota exceeded).
   */
  async sendEmail(dto: SendEmailDTO): Promise<SendEmailCommandOutput> {
    // Can't actually be empty: AWSSESModule throws at startup when SES is enabled
    // and this is unset, and sendEmail only runs when SES is enabled. The
    // fallback is only here to satisfy TypeScript.
    const senderEmail = process.env.AWS_SES_SENDER_EMAIL ?? '';

    const mailOptions: Mail.Options = {
      from: senderEmail,
      to: dto.toEmail,
      subject: dto.subject,
      html: dto.bodyHtml,
    };

    // cc is visible: set in MIME headers so recipients see who was cc'd.
    if (dto.ccEmails && dto.ccEmails.length > 0) {
      mailOptions.cc = dto.ccEmails;
    }
    // bcc is hidden: deliberately NOT set on mailOptions — doing so would
    // emit a `Bcc:` header in the raw MIME and leak the list to every
    // recipient. SES delivers to bcc addresses via Destination.BccAddresses
    // below without ever touching the headers.

    if (dto.attachments) {
      mailOptions.attachments = dto.attachments.map((a) => ({
        filename: a.filename,
        content: a.content,
      }));
    }

    try {
      const messageData = await new MailComposer(mailOptions).compile().build();
      const command = new SendEmailCommand({
        Destination: {
          ToAddresses: [dto.toEmail],
          ...(dto.ccEmails &&
            dto.ccEmails.length > 0 && { CcAddresses: dto.ccEmails }),
          ...(dto.bccEmails &&
            dto.bccEmails.length > 0 && { BccAddresses: dto.bccEmails }),
        },
        Content: { Raw: { Data: messageData } },
      });
      return await this.client.send(command);
    } catch (err) {
      throw err instanceof Error ? err : new Error(String(err));
    }
  }
}
