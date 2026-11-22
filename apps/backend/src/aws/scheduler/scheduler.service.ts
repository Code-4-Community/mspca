import { Inject, Injectable } from '@nestjs/common';
import {
  ActionAfterCompletion,
  CreateScheduleCommand,
  FlexibleTimeWindowMode,
  RetryPolicy,
  SchedulerClient,
} from '@aws-sdk/client-scheduler';
import { AMAZON_SCHEDULER_CLIENT } from './awsSchedulerClient.factory';

export interface ScheduleOnceInput {
  /** Schedule name, unique per account. IAM policies may match on its prefix. */
  name: string;
  /** When the target should be invoked. */
  at: Date;
  /** ARN of the target, e.g. a Lambda. */
  targetArn: string;
  /** ARN of the role Scheduler assumes to invoke the target. */
  roleArn: string;
  /** Passed to the target as its event, serialized to JSON. */
  input: unknown;
  retryPolicy: RetryPolicy;
}

@Injectable()
export class SchedulerService {
  constructor(
    @Inject(AMAZON_SCHEDULER_CLIENT)
    private readonly scheduler: SchedulerClient,
  ) {}

  /**
   * Creates a one-time EventBridge Scheduler schedule that invokes `targetArn`
   * with `input` at `at`, then deletes itself.
   *
   * Callers own what is scheduled (target, payload, retries, name prefix); this
   * only owns how Scheduler is asked to do it.
   *
   * @param params - The schedule name, time, target, role, payload, and retry policy.
   * @returns Resolves once Scheduler has accepted the schedule.
   * @throws Error from the AWS SDK if Scheduler rejects the request.
   */
  async scheduleOnce({
    name,
    at,
    targetArn,
    roleArn,
    input,
    retryPolicy,
  }: ScheduleOnceInput): Promise<void> {
    await this.scheduler.send(
      new CreateScheduleCommand({
        Name: name,
        // at() rejects the trailing Z and the milliseconds that toISOString() emits.
        ScheduleExpression: `at(${at.toISOString().slice(0, 19)})`,
        ScheduleExpressionTimezone: 'UTC',
        FlexibleTimeWindow: { Mode: FlexibleTimeWindowMode.OFF },
        ActionAfterCompletion: ActionAfterCompletion.DELETE,
        Target: {
          Arn: targetArn,
          RoleArn: roleArn,
          RetryPolicy: retryPolicy,
          Input: JSON.stringify(input),
        },
      }),
    );
  }
}
