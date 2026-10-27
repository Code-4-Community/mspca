# Scheduled notifications: AWS setup

`POST /notifications` with `sendAt` doesn't send right away. It creates a one-time AWS schedule, and AWS calls the backend back at that time.

```
immediate:  POST /notifications --> sendNow() --> SES
scheduled:  POST /notifications --> Scheduler (waits until sendAt) --> Lambda --> POST /notifications/send-scheduled --> sendNow() --> SES
```

- Recipients are looked up at send time, so volunteers who went inactive in between are left out.
- The schedule deletes itself after it fires.
- Code: [notifications/](../../apps/backend/src/notifications) · [index.mjs](./index.mjs)

## Resources (dev, `us-east-2`)

| Resource    | Name                           | Purpose                                                                            |
| ----------- | ------------------------------ | ---------------------------------------------------------------------------------- |
| Lambda      | `mspca-notif-dispatch`         | Node 22, 30s timeout, 2 async retries. Forwards the schedule to `/send-scheduled`. |
| IAM role    | `mspca-notif-lambda-role`      | Runs the Lambda (CloudWatch logs only)                                             |
| IAM role    | `mspca-notif-scheduler-role`   | Lets Scheduler invoke only this Lambda                                             |
| User policy | `mspca-notif-create-schedules` | Lets the backend's IAM user create schedules and pass the scheduler role           |

## Connect to the existing dev setup

Nothing to create. Immediate sends need only the usual SES vars. Scheduled sends also need these 3 in `.env`. Ask the ticket owner by DM, and never commit them:

```
AWS_NOTIFICATION_DISPATCH_LAMBDA_ARN=
AWS_SCHEDULER_ROLE_ARN=
NOTIFICATIONS_DISPATCH_SECRET=      # same value as the Lambda's
```

> The dev Lambda calls the **owner's ngrok tunnel** (`ngrok http 3000`). Any scheduled send, from anyone's laptop, fires into the owner's local backend. Test the full chain on the owner's machine. This goes away once the backend is deployed.

## Testing

Run `yarn serve:backend` with `AUTH_DISABLED=true`. In another tab, set `AWS_REGION=us-east-2`, `DISPATCH_SECRET` (your `.env` value) and `DISPATCH_URL`: the ngrok URL on the owner's machine, or `http://localhost:3000/api/notifications/send-scheduled` for everyone else.

| #   | Test                       | Command                                                                                                                                                                                               | Expect                                              | Dev run |
| --- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | ------- |
| T0  | No secret                  | `curl -i -X POST ${DISPATCH_URL}`                                                                                                                                                                     | 401                                                 | ✅      |
| T1  | Right secret, empty body   | T0 + `-H "x-notifications-dispatch-secret: ${DISPATCH_SECRET}" -H 'content-type: application/json' -d '{}'`                                                                                           | 400                                                 | ✅      |
| T2  | Wrong secret               | T1 with secret `wrong` and a valid body                                                                                                                                                               | 401, no email                                       | ✅      |
| T3  | Send now                   | `curl -i -X POST localhost:3000/api/notifications -H 'content-type: application/json' -d '{"subject":"t3","body":"<p>t3</p>","filters":["Dog"]}'`                                                     | 202, only Dog volunteers get it                     | ✅      |
| T4  | Lambda --> backend (owner) | `aws lambda invoke --region ${AWS_REGION} --function-name mspca-notif-dispatch --cli-binary-format raw-in-base64-out --payload '{"subject":"t4","body":"<p>t4</p>","filters":["Cat"]}' /tmp/out.json` | `StatusCode 200`, `null`                            | ✅      |
| T5  | Full chain (owner)         | T3 with `"filters":[]` and `"sendAt":"$(date -u -v+2M +%Y-%m-%dT%H:%M:%SZ)"`                                                                                                                          | 202, all active volunteers get it about 2 min later | ✅      |
| T6  | Retries (owner)            | Stop the backend, run T4 with `--invocation-type Event`, then `aws logs tail /aws/lambda/mspca-notif-dispatch --since 10m`                                                                            | 3 `Dispatch failed` lines, no email                 | ✅      |
| T7  | Validation                 | past `sendAt`, `filters:["Horse"]`, missing field, line break in subject                                                                                                                              | 400                                                 | ✅      |

The dev run was 2026-10-26/27. Unit tests: `npx jest apps/backend/src/notifications`.

## Create from scratch (prod / rebuild)

Only for a new environment or if the dev resources are deleted. For prod, use new names and a new secret. You need a CLI login with IAM and Lambda admin rights.

> **zsh:** write `${VAR}` with braces. `$ACCOUNT_ID:role` gets eaten by zsh's `:r` modifier.

```bash
# 0. shell vars (this tab only; save the secret)
export AWS_REGION=us-east-2
export ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
export DISPATCH_SECRET=$(openssl rand -hex 32)
export DISPATCH_URL=https://<api host>/api/notifications/send-scheduled

# 1. lambda role
aws iam create-role --role-name mspca-notif-lambda-role \
  --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}]}'
aws iam attach-role-policy --role-name mspca-notif-lambda-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
sleep 10   # let the role propagate

# 2. lambda
zip -j /tmp/notif-dispatch.zip infra/notification-dispatch-lambda/index.mjs
aws lambda create-function --region ${AWS_REGION} --function-name mspca-notif-dispatch \
  --runtime nodejs22.x --handler index.handler --timeout 30 \
  --zip-file fileb:///tmp/notif-dispatch.zip \
  --role arn:aws:iam::${ACCOUNT_ID}:role/mspca-notif-lambda-role \
  --environment "Variables={NOTIFICATIONS_DISPATCH_URL=${DISPATCH_URL},NOTIFICATIONS_DISPATCH_SECRET=${DISPATCH_SECRET}}"
aws lambda put-function-event-invoke-config --region ${AWS_REGION} \
  --function-name mspca-notif-dispatch --maximum-retry-attempts 2

# 3. scheduler role
aws iam create-role --role-name mspca-notif-scheduler-role \
  --assume-role-policy-document "{\"Version\":\"2012-10-17\",\"Statement\":[{\"Effect\":\"Allow\",\"Principal\":{\"Service\":\"scheduler.amazonaws.com\"},\"Action\":\"sts:AssumeRole\",\"Condition\":{\"StringEquals\":{\"aws:SourceAccount\":\"${ACCOUNT_ID}\"}}}]}"
aws iam put-role-policy --role-name mspca-notif-scheduler-role --policy-name invoke-notif-dispatch \
  --policy-document "{\"Version\":\"2012-10-17\",\"Statement\":[{\"Effect\":\"Allow\",\"Action\":\"lambda:InvokeFunction\",\"Resource\":\"arn:aws:lambda:${AWS_REGION}:${ACCOUNT_ID}:function:mspca-notif-dispatch\"}]}"

# 4. backend IAM user (the one behind .env's AWS key)
export BACKEND_USER=$( (set -a; source .env; aws sts get-caller-identity --query Arn --output text) | sed 's|.*/||' )
aws iam put-user-policy --user-name ${BACKEND_USER} --policy-name mspca-notif-create-schedules \
  --policy-document "{\"Version\":\"2012-10-17\",\"Statement\":[{\"Effect\":\"Allow\",\"Action\":\"scheduler:CreateSchedule\",\"Resource\":\"arn:aws:scheduler:${AWS_REGION}:${ACCOUNT_ID}:schedule/default/notification-*\"},{\"Effect\":\"Allow\",\"Action\":\"iam:PassRole\",\"Resource\":\"arn:aws:iam::${ACCOUNT_ID}:role/mspca-notif-scheduler-role\",\"Condition\":{\"StringEquals\":{\"iam:PassedToService\":\"scheduler.amazonaws.com\"}}}]}"

# 5. backend env: paste into .env or the host's config, then restart
echo "AWS_NOTIFICATION_DISPATCH_LAMBDA_ARN=arn:aws:lambda:${AWS_REGION}:${ACCOUNT_ID}:function:mspca-notif-dispatch"
echo "AWS_SCHEDULER_ROLE_ARN=arn:aws:iam::${ACCOUNT_ID}:role/mspca-notif-scheduler-role"
echo "NOTIFICATIONS_DISPATCH_SECRET=${DISPATCH_SECRET}"
```

To change the Lambda's URL or secret later, run `aws lambda update-function-configuration` with the same `--environment` as step 2. After editing `index.mjs`, rezip and run `aws lambda update-function-code --function-name mspca-notif-dispatch --zip-file fileb:///tmp/notif-dispatch.zip`.

## Prod checklist

- [ ] Add `@Public()` to `/send-scheduled`. The Cognito guard is global, and the Lambda has no token, so it gets a 401 once auth is on.
- [ ] Deploy the backend, point the Lambda's `NOTIFICATIONS_DISPATCH_URL` at it, and put the step 5 vars in the host's config.
- [ ] Use separate prod resources and a new secret, so dev tests can't email real volunteers.
- [ ] Send from a verified domain (for example `c4cneu.com`), not Gmail. Gmail sends land in spam.
- [ ] Follow-ups: failed SES batches aren't retried (only logged); coordinator-only role gating; `ArrayOverlap()` after [#11](https://github.com/Code-4-Community/mspca/pull/11).

## Troubleshooting

| Symptom                                         | Fix                                                                                     |
| ----------------------------------------------- | --------------------------------------------------------------------------------------- |
| ARN regex error like `...177ole/`               | zsh `:r` modifier. Use `${VAR}` braces.                                                 |
| `POST /notifications` with `sendAt` returns 500 | Scheduler env vars unset, or step 4 `iam:PassRole` missing. Check the backend log.      |
| Lambda log `Dispatch failed: 401`               | Secrets differ between `.env` and the Lambda (in prod, also the `@Public()` item above) |
| Lambda log `Dispatch failed: 404` / `502`       | Wrong URL path, or the tunnel/backend is down                                           |
| No Lambda logs at all                           | Scheduler can't invoke it. Check the step 3 role and the ARN in `.env`.                 |

## Cleanup

```bash
aws lambda delete-function --region ${AWS_REGION} --function-name mspca-notif-dispatch
aws iam detach-role-policy --role-name mspca-notif-lambda-role --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
aws iam delete-role --role-name mspca-notif-lambda-role
aws iam delete-role-policy --role-name mspca-notif-scheduler-role --policy-name invoke-notif-dispatch
aws iam delete-role --role-name mspca-notif-scheduler-role
aws iam delete-user-policy --user-name ${BACKEND_USER} --policy-name mspca-notif-create-schedules
```

Refs: [Scheduler one-time schedules](https://docs.aws.amazon.com/scheduler/latest/UserGuide/schedule-types.html#one-time) · [Scheduler execution role](https://docs.aws.amazon.com/scheduler/latest/UserGuide/setting-up.html#setting-up-execution-role) · [Lambda async retries](https://docs.aws.amazon.com/lambda/latest/dg/invocation-async.html) · [`iam:PassRole`](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_use_passrole.html)
