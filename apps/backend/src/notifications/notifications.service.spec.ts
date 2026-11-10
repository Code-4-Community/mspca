import { Test, TestingModule } from '@nestjs/testing';
import { InternalServerErrorException } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { AMAZON_SCHEDULER_CLIENT } from './awsScheduler.factory';
import { EmailsService } from '../aws/ses/email.service';
import { VolunteersService } from '../volunteers/volunteers.service';
import { FosterVolunteer } from '../volunteers/volunteers.entity';
import { FosterType } from '../volunteers/volunteers.types';

const SENDER = 'sender@mspca.org';

/** Builds `count` volunteers with distinct emails. */
const volunteers = (count: number) =>
  Array.from(
    { length: count },
    (_, i) => ({ email: `volunteer${i}@example.com` } as FosterVolunteer),
  );

describe('NotificationsService', () => {
  let service: NotificationsService;
  let emailsService: { sendEmail: jest.Mock };
  let volunteersService: { findActiveByFosterTypes: jest.Mock };
  let scheduler: { send: jest.Mock };

  const dto = { subject: 'Fosters needed', body: '<p>Please help.</p>' };

  const ENV_VARS = [
    'AWS_SES_SENDER_EMAIL',
    'AWS_NOTIFICATION_DISPATCH_LAMBDA_ARN',
    'AWS_SCHEDULER_ROLE_ARN',
  ] as const;
  const originalEnv: Record<string, string | undefined> = {};

  /** The bccEmails array of each sendEmail call, in order. */
  const sentBatches = (): string[][] =>
    emailsService.sendEmail.mock.calls.map((c) => c[0].bccEmails);

  beforeEach(async () => {
    for (const name of ENV_VARS) {
      originalEnv[name] = process.env[name];
    }

    process.env.AWS_SES_SENDER_EMAIL = SENDER;

    process.env.AWS_NOTIFICATION_DISPATCH_LAMBDA_ARN = 'arn:aws:lambda:::fn';
    process.env.AWS_SCHEDULER_ROLE_ARN = 'arn:aws:iam:::role/scheduler';

    emailsService = { sendEmail: jest.fn().mockResolvedValue(undefined) };
    scheduler = { send: jest.fn().mockResolvedValue({}) };
    volunteersService = {
      findActiveByFosterTypes: jest.fn().mockResolvedValue(volunteers(1)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: EmailsService, useValue: emailsService },
        { provide: VolunteersService, useValue: volunteersService },
        { provide: AMAZON_SCHEDULER_CLIENT, useValue: scheduler },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  afterEach(() => {
    for (const name of ENV_VARS) {
      if (originalEnv[name] === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = originalEnv[name];
      }
    }
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sendNow', () => {
    it('bccs the recipients and puts the sender in the to slot', async () => {
      await service.sendNow(dto);

      expect(emailsService.sendEmail).toHaveBeenCalledWith({
        toEmail: SENDER,
        subject: 'Fosters needed',
        bodyHtml: '<p>Please help.</p>',
        bccEmails: ['volunteer0@example.com'],
      });
    });

    it('passes the filters through to the volunteer lookup', async () => {
      await service.sendNow({
        ...dto,
        filters: [FosterType.DOG, FosterType.CAT],
      });

      expect(volunteersService.findActiveByFosterTypes).toHaveBeenCalledWith([
        FosterType.DOG,
        FosterType.CAT,
      ]);
    });

    it('looks up every active volunteer when no filters are given', async () => {
      await service.sendNow(dto);

      expect(volunteersService.findActiveByFosterTypes).toHaveBeenCalledWith(
        [],
      );
    });

    // SES rejects a message with more than 50 recipients across To, Cc and Bcc,
    // and the sender takes one of those slots, so a batch may hold at most 49.
    it.each([
      [48, [48]],
      [49, [49]],
      [50, [49, 1]],
      [98, [49, 49]],
      [99, [49, 49, 1]],
    ])('splits %i recipients into batches of %j', async (count, expected) => {
      volunteersService.findActiveByFosterTypes.mockResolvedValue(
        volunteers(count),
      );

      await service.sendNow(dto);

      expect(sentBatches().map((b) => b.length)).toEqual(expected);
    });

    it('sends to every recipient exactly once across the batches', async () => {
      volunteersService.findActiveByFosterTypes.mockResolvedValue(
        volunteers(60),
      );

      await service.sendNow(dto);

      expect(sentBatches().flat()).toEqual(volunteers(60).map((v) => v.email));
    });

    it('deduplicates volunteers sharing an email address', async () => {
      volunteersService.findActiveByFosterTypes.mockResolvedValue([
        { email: 'shared@example.com' },
        { email: 'shared@example.com' },
      ] as FosterVolunteer[]);

      await service.sendNow(dto);

      expect(sentBatches()).toEqual([['shared@example.com']]);
    });

    // SendEmailDTO caps each Bcc address at 255 characters as well as validating it,
    // so an overlong address would reject its whole batch of 49.
    it('drops an address over 255 characters', async () => {
      volunteersService.findActiveByFosterTypes.mockResolvedValue([
        { email: 'good@example.com' },
        { email: `${'a'.repeat(250)}@example.com` },
      ] as FosterVolunteer[]);

      await service.sendNow(dto);

      expect(sentBatches()).toEqual([['good@example.com']]);
    });

    it('sends nothing when every address is unusable', async () => {
      volunteersService.findActiveByFosterTypes.mockResolvedValue([
        { email: 'not-an-email' },
      ] as FosterVolunteer[]);

      await service.sendNow(dto);

      expect(emailsService.sendEmail).not.toHaveBeenCalled();
    });

    it('treats emails differing only in case as duplicates', async () => {
      volunteersService.findActiveByFosterTypes.mockResolvedValue([
        { email: 'dup@example.com' },
        { email: 'DUP@example.com' },
      ] as FosterVolunteer[]);

      await service.sendNow(dto);

      expect(sentBatches()).toEqual([['dup@example.com']]);
    });

    it('skips invalid addresses instead of failing their batch', async () => {
      volunteersService.findActiveByFosterTypes.mockResolvedValue([
        { email: 'good@example.com' },
        { email: 'not-an-email' },
      ] as FosterVolunteer[]);

      await service.sendNow(dto);

      expect(sentBatches()).toEqual([['good@example.com']]);
    });

    it('sends the later batches when an earlier one fails', async () => {
      volunteersService.findActiveByFosterTypes.mockResolvedValue(
        volunteers(98),
      );
      emailsService.sendEmail
        .mockRejectedValueOnce(new Error('SES rejected the send'))
        .mockResolvedValueOnce(undefined);

      await expect(service.sendNow(dto)).resolves.toBeUndefined();

      expect(emailsService.sendEmail).toHaveBeenCalledTimes(2);
    });

    it('fails when every batch fails to send', async () => {
      volunteersService.findActiveByFosterTypes.mockResolvedValue(
        volunteers(98),
      );
      emailsService.sendEmail.mockRejectedValue(
        new Error('SES rejected the send'),
      );

      await expect(service.sendNow(dto)).rejects.toThrow(
        InternalServerErrorException,
      );

      expect(emailsService.sendEmail).toHaveBeenCalledTimes(2);
    });

    it('sends nothing when no volunteers match', async () => {
      volunteersService.findActiveByFosterTypes.mockResolvedValue([]);

      await service.sendNow(dto);

      expect(emailsService.sendEmail).not.toHaveBeenCalled();
    });

    it('fails when the sender address is not configured', async () => {
      delete process.env.AWS_SES_SENDER_EMAIL;

      await expect(service.sendNow(dto)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('createBulkNotification', () => {
    const sendAt = new Date('2030-01-01T09:30:00.000Z');

    /** The CreateScheduleCommand input from the single scheduler call. */
    const scheduleInput = () => scheduler.send.mock.calls[0][0].input;

    it('sends immediately and creates no schedule when sendAt is absent', async () => {
      await expect(
        service.createBulkNotification(dto),
      ).resolves.toBeUndefined();

      expect(emailsService.sendEmail).toHaveBeenCalled();
      expect(scheduler.send).not.toHaveBeenCalled();
    });

    it('creates a schedule and emails nobody when sendAt is given', async () => {
      await expect(
        service.createBulkNotification({ ...dto, sendAt }),
      ).resolves.toBeUndefined();

      expect(scheduler.send).toHaveBeenCalledTimes(1);
      expect(emailsService.sendEmail).not.toHaveBeenCalled();
      expect(volunteersService.findActiveByFosterTypes).not.toHaveBeenCalled();
    });

    // at() rejects the trailing Z and milliseconds that toISOString() emits.
    it('formats sendAt as an at() expression in UTC', async () => {
      await service.createBulkNotification({ ...dto, sendAt });

      expect(scheduleInput()).toMatchObject({
        ScheduleExpression: 'at(2030-01-01T09:30:00)',
        ScheduleExpressionTimezone: 'UTC',
        FlexibleTimeWindow: { Mode: 'OFF' },
        ActionAfterCompletion: 'DELETE',
      });
    });

    // Scheduler's default is up to 185 retries over 24 hours, which would keep
    // re-posting to the dispatch route all day when the config is simply wrong.
    it('bounds the retries instead of taking the 24 hour default', async () => {
      await service.createBulkNotification({ ...dto, sendAt });

      expect(scheduleInput().Target.RetryPolicy).toEqual({
        MaximumRetryAttempts: 2,
        MaximumEventAgeInSeconds: 600,
      });
    });

    // Resolving recipients at send time is what keeps inactive Volunteers out of
    // a notification scheduled while they were still active.
    it('stores the filters in the payload, never the resolved recipients', async () => {
      await service.createBulkNotification({
        ...dto,
        sendAt,
        filters: [FosterType.DOG],
      });

      expect(JSON.parse(scheduleInput().Target.Input)).toEqual({
        subject: 'Fosters needed',
        body: '<p>Please help.</p>',
        filters: [FosterType.DOG],
      });
    });

    it('fails when the scheduler target is not configured', async () => {
      delete process.env.AWS_NOTIFICATION_DISPATCH_LAMBDA_ARN;

      await expect(
        service.createBulkNotification({ ...dto, sendAt }),
      ).rejects.toThrow(InternalServerErrorException);

      expect(scheduler.send).not.toHaveBeenCalled();
    });
  });
});
