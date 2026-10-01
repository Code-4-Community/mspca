import { Test } from '@nestjs/testing';
import {
  SendEmailCommand,
  SendEmailCommandOutput,
} from '@aws-sdk/client-sesv2';
import { AmazonSESWrapper } from './awsSes.wrapper';
import { AMAZON_SES_CLIENT } from './awsSesClient.factory';
import { SendEmailDTO } from './sendEmail.dto';

describe('AmazonSESWrapper', () => {
  let wrapper: AmazonSESWrapper;
  let mockClient: { send: jest.Mock };

  const originalSenderEmail = process.env.AWS_SES_SENDER_EMAIL;

  const successOutput: SendEmailCommandOutput = {
    MessageId: 'msg-1',
    $metadata: { httpStatusCode: 200 },
  } as SendEmailCommandOutput;

  const validDto: SendEmailDTO = {
    toEmail: 'recipient@example.com',
    subject: 'Hello',
    bodyHtml: '<p>Hi there</p>',
  };

  /** The SendEmailCommand the wrapper handed to the client on its only send. */
  const sentCommand = (): SendEmailCommand =>
    mockClient.send.mock.calls[0][0] as SendEmailCommand;

  /** The composed MIME message, decoded so headers can be inspected. */
  const sentRawMessage = (): string => {
    const data = sentCommand().input.Content?.Raw?.Data;
    if (!data) {
      throw new Error('Expected the sent command to carry a raw MIME message');
    }
    return Buffer.from(data).toString('utf8');
  };

  beforeEach(async () => {
    mockClient = { send: jest.fn().mockResolvedValue(successOutput) };
    process.env.AWS_SES_SENDER_EMAIL = 'sender@example.com';

    const moduleRef = await Test.createTestingModule({
      providers: [
        AmazonSESWrapper,
        { provide: AMAZON_SES_CLIENT, useValue: mockClient },
      ],
    }).compile();

    wrapper = moduleRef.get<AmazonSESWrapper>(AmazonSESWrapper);
  });

  afterEach(() => {
    if (originalSenderEmail === undefined) {
      delete process.env.AWS_SES_SENDER_EMAIL;
    } else {
      process.env.AWS_SES_SENDER_EMAIL = originalSenderEmail;
    }
  });

  describe('sendEmail', () => {
    it('returns the client output and sends exactly one command', async () => {
      const result = await wrapper.sendEmail(validDto);

      expect(mockClient.send).toHaveBeenCalledTimes(1);
      expect(sentCommand()).toBeInstanceOf(SendEmailCommand);
      expect(result).toBe(successOutput);
    });

    it('addresses the recipient in Destination and in the MIME headers', async () => {
      await wrapper.sendEmail(validDto);

      expect(mockClient.send).toHaveBeenCalledTimes(1);
      expect(sentCommand().input.Destination).toEqual({
        ToAddresses: ['recipient@example.com'],
      });

      const raw = sentRawMessage();
      expect(raw).toContain('To: recipient@example.com');
      expect(raw).toContain('Subject: Hello');
      expect(raw).toContain('<p>Hi there</p>');
    });

    it('uses AWS_SES_SENDER_EMAIL as the From address', async () => {
      process.env.AWS_SES_SENDER_EMAIL = 'noreply@mspca.org';

      await wrapper.sendEmail(validDto);

      expect(mockClient.send).toHaveBeenCalledTimes(1);
      expect(sentRawMessage()).toContain('From: noreply@mspca.org');
    });

    it('puts cc addresses in both Destination and the MIME headers', async () => {
      await wrapper.sendEmail({
        ...validDto,
        ccEmails: ['cc1@example.com', 'cc2@example.com'],
      });

      expect(mockClient.send).toHaveBeenCalledTimes(1);
      expect(sentCommand().input.Destination?.CcAddresses).toEqual([
        'cc1@example.com',
        'cc2@example.com',
      ]);
      expect(sentRawMessage()).toContain(
        'Cc: cc1@example.com, cc2@example.com',
      );
    });

    it('puts bcc addresses in Destination but never in the MIME headers', async () => {
      await wrapper.sendEmail({
        ...validDto,
        bccEmails: ['bcc@example.com'],
      });

      expect(mockClient.send).toHaveBeenCalledTimes(1);
      expect(sentCommand().input.Destination?.BccAddresses).toEqual([
        'bcc@example.com',
      ]);

      // A `Bcc:` header would leak the hidden recipient list to everyone else
      // on the message, so it must not appear anywhere in the raw MIME.
      // Note: MailComposer also strips Bcc unless `keepBcc: true` is passed,
      // so this locks in the end behaviour rather than the wrapper's choice
      // to leave `mailOptions.bcc` unset.
      const raw = sentRawMessage();
      expect(raw).not.toMatch(/^Bcc:/im);
      expect(raw).not.toContain('bcc@example.com');
    });

    it('omits CcAddresses and BccAddresses when the lists are absent or empty', async () => {
      await wrapper.sendEmail({ ...validDto, ccEmails: [], bccEmails: [] });

      expect(mockClient.send).toHaveBeenCalledTimes(1);
      expect(sentCommand().input.Destination).toEqual({
        ToAddresses: ['recipient@example.com'],
      });
    });

    it('encodes attachments into the MIME message', async () => {
      await wrapper.sendEmail({
        ...validDto,
        attachments: [
          { filename: 'notes.txt', content: Buffer.from('hello attachment') },
        ],
      });

      expect(mockClient.send).toHaveBeenCalledTimes(1);
      const raw = sentRawMessage();
      expect(raw).toContain('filename=notes.txt');
      expect(raw).toContain(Buffer.from('hello attachment').toString('base64'));
    });

    it('propagates errors thrown by the SES client', async () => {
      mockClient.send.mockRejectedValue(new Error('SES rejected: throttled'));

      await expect(wrapper.sendEmail(validDto)).rejects.toThrow(
        'SES rejected: throttled',
      );
      expect(mockClient.send).toHaveBeenCalledTimes(1);
    });

    it('wraps non-Error rejections in an Error', async () => {
      mockClient.send.mockRejectedValue('throttled');

      await expect(wrapper.sendEmail(validDto)).rejects.toThrow('throttled');
      expect(mockClient.send).toHaveBeenCalledTimes(1);
    });
  });
});
