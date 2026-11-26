import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { FosterType } from '../volunteers/volunteers.types';
import { CreateBulkNotificationDto } from './dtos/create-bulk-notification.dto';
import { IS_PUBLIC_KEY } from '../aws/cognito/cognito.decorator';

describe('NotificationsController', () => {
  let controller: NotificationsController;
  let service: { createBulkNotification: jest.Mock; sendNow: jest.Mock };

  const validationPipe = new ValidationPipe({
    whitelist: true,
    transform: true,
  });

  const body = {
    subject: 'Fosters needed',
    body: '<p>Please help.</p>',
    filters: [FosterType.DOG],
  };

  beforeEach(async () => {
    service = {
      createBulkNotification: jest.fn().mockResolvedValue(undefined),
      sendNow: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [{ provide: NotificationsService, useValue: service }],
    }).compile();

    controller = module.get<NotificationsController>(NotificationsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createBulkNotification', () => {
    it('passes the body to the service and returns nothing', async () => {
      await expect(
        controller.createBulkNotification(body),
      ).resolves.toBeUndefined();

      expect(service.createBulkNotification).toHaveBeenCalledWith(body);
    });

    it('propagates service failures', async () => {
      service.createBulkNotification.mockRejectedValue(new Error('boom'));

      await expect(controller.createBulkNotification(body)).rejects.toThrow(
        'boom',
      );
    });

    it.each([{ filters: null }, { sendAt: null }])(
      'rejects %j',
      async (extra) => {
        await expect(
          validationPipe.transform(
            { subject: 'Fosters needed', body: 'Please help.', ...extra },
            { type: 'body', metatype: CreateBulkNotificationDto },
          ),
        ).rejects.toThrow(BadRequestException);
      },
    );

    it('accepts omitted filters and sendAt', async () => {
      const result = await validationPipe.transform(
        { subject: 'Fosters needed', body: 'Please help.' },
        { type: 'body', metatype: CreateBulkNotificationDto },
      );

      expect(result.filters).toBeUndefined();
      expect(result.sendAt).toBeUndefined();
    });
  });

  describe('dispatchNotification', () => {
    // The wait already happened in Scheduler, so dispatch sends rather than
    // going back through createBulkNotification and rescheduling.
    it('sends immediately without creating another schedule', async () => {
      await expect(
        controller.dispatchNotification(body),
      ).resolves.toBeUndefined();

      expect(service.sendNow).toHaveBeenCalledWith(body);
      expect(service.createBulkNotification).not.toHaveBeenCalled();
    });

    // The Lambda has no Cognito token, so the global CognitoJWTGuard must skip
    // this route and leave auth to NotificationsDispatchGuard.
    it('is public to Cognito', () => {
      expect(
        Reflect.getMetadata(
          IS_PUBLIC_KEY,
          NotificationsController.prototype.dispatchNotification,
        ),
      ).toBe(true);
    });
  });
});
