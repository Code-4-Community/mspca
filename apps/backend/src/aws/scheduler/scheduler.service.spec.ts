import { Test, TestingModule } from '@nestjs/testing';
import { SchedulerService } from './scheduler.service';
import { AMAZON_SCHEDULER_CLIENT } from './awsSchedulerClient.factory';

describe('SchedulerService', () => {
  let service: SchedulerService;
  let scheduler: { send: jest.Mock };

  const input = {
    name: 'test-schedule',
    at: new Date('2030-01-01T09:30:00.000Z'),
    targetArn: 'arn:aws:lambda:::fn',
    roleArn: 'arn:aws:iam:::role/scheduler',
    input: { hello: 'world' },
    retryPolicy: { MaximumRetryAttempts: 1, MaximumEventAgeInSeconds: 60 },
  };

  beforeEach(async () => {
    scheduler = { send: jest.fn().mockResolvedValue({}) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SchedulerService,
        { provide: AMAZON_SCHEDULER_CLIENT, useValue: scheduler },
      ],
    }).compile();

    service = module.get<SchedulerService>(SchedulerService);
  });

  it('creates a one-time, self-deleting UTC schedule for the target', async () => {
    await service.scheduleOnce(input);

    expect(scheduler.send).toHaveBeenCalledTimes(1);
    expect(scheduler.send.mock.calls[0][0].input).toEqual({
      Name: 'test-schedule',
      ScheduleExpression: 'at(2030-01-01T09:30:00)',
      ScheduleExpressionTimezone: 'UTC',
      FlexibleTimeWindow: { Mode: 'OFF' },
      ActionAfterCompletion: 'DELETE',
      Target: {
        Arn: 'arn:aws:lambda:::fn',
        RoleArn: 'arn:aws:iam:::role/scheduler',
        RetryPolicy: { MaximumRetryAttempts: 1, MaximumEventAgeInSeconds: 60 },
        Input: '{"hello":"world"}',
      },
    });
  });

  it('passes a Scheduler rejection through to the caller', async () => {
    scheduler.send.mockRejectedValueOnce(new Error('AccessDenied'));

    await expect(service.scheduleOnce(input)).rejects.toThrow('AccessDenied');
  });
});
