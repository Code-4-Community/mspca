# Scheduled notifications: AWS setup

`POST /notifications` with a `sendAt` doesn't send right away. It sets an alarm in AWS, and AWS calls the backend back at that time.

```
coordinator                                                         volunteers
    │                                                                    ▲
    │ POST /notifications {sendAt}                                       │ SES (Bcc, 49 per batch)
    ▼                                                                    │
 backend ──CreateSchedule──> EventBridge Scheduler ──(at sendAt)──> Lambda ──POST /notifications/send-scheduled──> backend
          (backend IAM user)    (mspca-notif-scheduler-role)   (mspca-notif-dispatch)   (x-notifications-dispatch-secret)
```

- No `sendAt`: the backend sends immediately (`sendNow`) and never touches AWS Scheduler.
- Recipients are looked up **at send time**, not at schedule time. A volunteer who goes inactive in between is left out.
- The schedule deletes itself after it fires (`ActionAfterCompletion.DELETE`).

Code: [notifications.service.ts](../../apps/backend/src/notifications/notifications.service.ts) · [notifications.controller.ts](../../apps/backend/src/notifications/notifications.controller.ts) · [notifications.dispatch.guard.ts](../../apps/backend/src/notifications/notifications.dispatch.guard.ts) · [index.mjs](./index.mjs)

---

## Resources

All resources are in `us-east-2`. The **dev** set listed here was created on 2026-10-26.

| Resource        | Name                           | Purpose                                                                                                                                        |
| --------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| IAM role        | `mspca-notif-lambda-role`      | Runs the Lambda. It can only write CloudWatch logs (`AWSLambdaBasicExecutionRole`).                                                            |
| Lambda          | `mspca-notif-dispatch`         | Node 22, 30s timeout, 2 async retries. Forwards the schedule's payload to the backend.                                                         |
| IAM role        | `mspca-notif-scheduler-role`   | Lets Scheduler invoke **only** `mspca-notif-dispatch` (inline policy `invoke-notif-dispatch`).                                                 |
| IAM user policy | `mspca-notif-create-schedules` | Attached to the backend's IAM user: `scheduler:CreateSchedule` on `schedule/default/notification-*` plus `iam:PassRole` on the scheduler role. |

## Env vars

| Where   | Var                                    | Value                                                                 |
| ------- | -------------------------------------- | --------------------------------------------------------------------- |
| Backend | `AWS_NOTIFICATION_DISPATCH_LAMBDA_ARN` | `arn:aws:lambda:us-east-2:<ACCOUNT_ID>:function:mspca-notif-dispatch` |
| Backend | `AWS_SCHEDULER_ROLE_ARN`               | `arn:aws:iam::<ACCOUNT_ID>:role/mspca-notif-scheduler-role`           |
| Backend | `NOTIFICATIONS_DISPATCH_SECRET`        | Shared secret. Generate with `openssl rand -hex 32`.                  |
| Lambda  | `NOTIFICATIONS_DISPATCH_SECRET`        | **Same** value as the backend's.                                      |
| Lambda  | `NOTIFICATIONS_DISPATCH_URL`           | `https://<api host>/api/notifications/send-scheduled`                 |

The backend also needs `SES_ENABLED=true` and a verified `AWS_SES_SENDER_EMAIL`. The SES account already has production access, so recipients don't need verifying. Only the sender does.

---

## Setup (CLI)

> **zsh users:** always write `${VAR}` with braces. zsh reads `$ACCOUNT_ID:role` as the `:r` modifier and silently produces `...177ole`.

The CLI identity needs IAM and Lambda admin rights. The backend's SES key is not enough.

### 0. Shell variables

These only live in the current terminal tab. Run every step in the same tab.

```bash
export AWS_REGION=us-east-2
export ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
export DISPATCH_SECRET=$(openssl rand -hex 32)   # save it: step 5 needs it, and re-running this makes a new one
export DISPATCH_URL=https://<api host or tunnel>/api/notifications/send-scheduled
```

### 1. Lambda role

```bash
aws iam create-role --role-name mspca-notif-lambda-role \
  --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}]}'

aws iam attach-role-policy --role-name mspca-notif-lambda-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
```

Wait about 10s before step 2, until the new role propagates.

### 2. Lambda

```bash
zip -j /tmp/notif-dispatch.zip infra/notification-dispatch-lambda/index.mjs

aws lambda create-function --region ${AWS_REGION} \
  --function-name mspca-notif-dispatch \
  --runtime nodejs22.x --handler index.handler \
  --zip-file fileb:///tmp/notif-dispatch.zip \
  --role arn:aws:iam::${ACCOUNT_ID}:role/mspca-notif-lambda-role \
  --timeout 30 \
  --environment "Variables={NOTIFICATIONS_DISPATCH_URL=${DISPATCH_URL},NOTIFICATIONS_DISPATCH_SECRET=${DISPATCH_SECRET}}"

aws lambda put-function-event-invoke-config --region ${AWS_REGION} \
  --function-name mspca-notif-dispatch --maximum-retry-attempts 2
```

Use this to change the URL or secret later, for example on a new tunnel or for deploy:

```bash
aws lambda update-function-configuration --region ${AWS_REGION} --function-name mspca-notif-dispatch \
  --environment "Variables={NOTIFICATIONS_DISPATCH_URL=${DISPATCH_URL},NOTIFICATIONS_DISPATCH_SECRET=${DISPATCH_SECRET}}"
```

To redeploy after editing `index.mjs`: rebuild the zip, then run `aws lambda update-function-code --function-name mspca-notif-dispatch --zip-file fileb:///tmp/notif-dispatch.zip`.

### 3. Scheduler role

```bash
aws iam create-role --role-name mspca-notif-scheduler-role \
  --assume-role-policy-document "{\"Version\":\"2012-10-17\",\"Statement\":[{\"Effect\":\"Allow\",\"Principal\":{\"Service\":\"scheduler.amazonaws.com\"},\"Action\":\"sts:AssumeRole\",\"Condition\":{\"StringEquals\":{\"aws:SourceAccount\":\"${ACCOUNT_ID}\"}}}]}"

aws iam put-role-policy --role-name mspca-notif-scheduler-role \
  --policy-name invoke-notif-dispatch \
  --policy-document "{\"Version\":\"2012-10-17\",\"Statement\":[{\"Effect\":\"Allow\",\"Action\":\"lambda:InvokeFunction\",\"Resource\":\"arn:aws:lambda:${AWS_REGION}:${ACCOUNT_ID}:function:mspca-notif-dispatch\"}]}"
```

### 4. Backend IAM user

```bash
# which IAM user the backend's .env key belongs to
export BACKEND_USER=$( (set -a; source .env; aws sts get-caller-identity --query Arn --output text) | sed 's|.*/||' )

aws iam put-user-policy --user-name ${BACKEND_USER} \
  --policy-name mspca-notif-create-schedules \
  --policy-document "{\"Version\":\"2012-10-17\",\"Statement\":[{\"Effect\":\"Allow\",\"Action\":\"scheduler:CreateSchedule\",\"Resource\":\"arn:aws:scheduler:${AWS_REGION}:${ACCOUNT_ID}:schedule/default/notification-*\"},{\"Effect\":\"Allow\",\"Action\":\"iam:PassRole\",\"Resource\":\"arn:aws:iam::${ACCOUNT_ID}:role/mspca-notif-scheduler-role\",\"Condition\":{\"StringEquals\":{\"iam:PassedToService\":\"scheduler.amazonaws.com\"}}}]}"
```

### 5. Backend env

```bash
echo "AWS_NOTIFICATION_DISPATCH_LAMBDA_ARN=arn:aws:lambda:${AWS_REGION}:${ACCOUNT_ID}:function:mspca-notif-dispatch"
echo "AWS_SCHEDULER_ROLE_ARN=arn:aws:iam::${ACCOUNT_ID}:role/mspca-notif-scheduler-role"
echo "NOTIFICATIONS_DISPATCH_SECRET=${DISPATCH_SECRET}"
```

Paste these into `.env` (locally) or the host's config (deployed), then restart the backend. It reads env only at startup.

---

## Local testing

The Lambda runs in AWS and can't reach `localhost`, so you need a public tunnel to your laptop:

```
Lambda / curl ──> https://<tunnel host> ──> tunnel on your Mac ──> localhost:3000
```

| Tunnel                                                                                                                                    | Command                                          | Notes                                                                                   |
| ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | --------------------------------------------------------------------------------------- |
| [ngrok](https://ngrok.com/docs/getting-started/)                                                                                          | `ngrok http 3000`                                | Free account. One fixed domain, so the URL survives restarts.                           |
| [cloudflared](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/trycloudflare/) | `cloudflared tunnel --url http://localhost:3000` | No account. The URL changes on every restart, so rerun the step 2 env update each time. |

Run three tabs: A `yarn serve:backend`, B the tunnel, C the commands below. Local auth is off (`AUTH_DISABLED=true`).

| #   | Tests                      | Command                                                                                                                                                                                                    | Expect                                                      |
| --- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| T0  | Tunnel reaches the backend | `curl -i -X POST ${DISPATCH_URL}`                                                                                                                                                                          | 401 (no secret sent)                                        |
| T1  | Secret matches             | `curl -i -X POST ${DISPATCH_URL} -H "x-notifications-dispatch-secret: ${DISPATCH_SECRET}" -H 'content-type: application/json' -d '{}'`                                                                     | 400 (guard passed, DTO failed)                              |
| T2  | Wrong secret is rejected   | same as T1 with `-H 'x-notifications-dispatch-secret: wrong'` and a valid body                                                                                                                             | 401, no email                                               |
| T3  | Send now with a filter     | `curl -i -X POST localhost:3000/api/notifications -H 'content-type: application/json' -d '{"subject":"t3","body":"<p>t3</p>","filters":["Dog"]}'`                                                          | 202. Only Dog volunteers get it.                            |
| T4  | Lambda to backend          | `aws lambda invoke --region ${AWS_REGION} --function-name mspca-notif-dispatch --cli-binary-format raw-in-base64-out --payload '{"subject":"t4","body":"<p>t4</p>","filters":["Cat"]}' /tmp/out.json`      | `StatusCode 200`, `null` in out.json, the tunnel logs `204` |
| T5  | Full chain                 | `curl -i -X POST localhost:3000/api/notifications -H 'content-type: application/json' -d "{\"subject\":\"t5\",\"body\":\"<p>t5</p>\",\"filters\":[],\"sendAt\":\"$(date -u -v+2M +%Y-%m-%dT%H:%M:%SZ)\"}"` | 202. About 2 min later every Active volunteer gets it.      |
| T6  | Lambda retries             | Stop the backend, then run T4 with `--invocation-type Event`. Check `aws logs tail /aws/lambda/mspca-notif-dispatch --region ${AWS_REGION} --since 10m`.                                                   | 3 `Dispatch failed` lines (1 try + 2 retries), no email     |
| T7  | Validation                 | `sendAt` in the past, or `filters:["Horse"]`                                                                                                                                                               | 400                                                         |

`date -u -v+2M` is macOS syntax. On Linux use `date -u -d '+2 min' ...`.

### Dev run, 2026-10-26

| Test                                                        | Result                                                     |
| ----------------------------------------------------------- | ---------------------------------------------------------- |
| Unit tests (`npx jest apps/backend/src/notifications`)      | ✅ 4 suites, 43 tests (2026-10-27)                         |
| T0 no secret / T2 wrong secret                              | ✅ 401 / 401                                               |
| T1 right secret, empty body                                 | ✅ 400                                                     |
| T3 send now, `filters: ["Dog"]`                             | ✅ 202, no send errors logged                              |
| T4 Lambda to backend, `filters: ["Cat"]`                    | ✅ `StatusCode 200`, `null`                                |
| T5 full chain, `filters: []`                                | ✅ All 4 seeded Active volunteers received it              |
| T7 past `sendAt` / bad filter / missing body / CRLF subject | ✅ 400 ×4                                                  |
| T6 Lambda retries, backend down                             | ✅ 3 attempts (07:24, 07:25, 07:27 UTC), all 502, no email |

Seeded test rows: `foster_volunteers` ids 82–85, one per foster type. Remove them with `DELETE FROM foster_volunteers WHERE volunteer_id BETWEEN 82 AND 85;`.

---

## Prod checklist

**Blockers**

- [ ] **Make `/send-scheduled` skip Cognito.** `CognitoJWTGuard` is a global `APP_GUARD` ([cognito.module.ts](../../apps/backend/src/aws/cognito/cognito.module.ts)), and the route has no `@Public()`. The Lambda has no Cognito token, so once auth is on every dispatch gets a 401. It works locally only because `AUTH_DISABLED=true`. Fix: add `@Public()` to the route; `NotificationsDispatchGuard` still protects it.
- [ ] **Deploy the backend** at a public HTTPS host. The repo has no deploy pipeline yet ([backend_build.yml](../../.github/workflows/backend_build.yml) only builds).
- [ ] **Point the Lambda at prod:** set `NOTIFICATIONS_DISPATCH_URL=https://<prod api>/api/notifications/send-scheduled` (step 2 update).
- [ ] **Put the backend env vars in the host's config**, never a committed file. Set the 3 vars from step 5 plus `SES_ENABLED=true` and `AWS_SES_SENDER_EMAIL`.

**Should do**

- [ ] **Separate prod resources** (`mspca-notif-dispatch-prod`, its own scheduler role, its own secret), so dev testing can never email real volunteers. Rerun steps 0–5 with new names.
- [ ] **Least-privilege backend user.** Prod should use a dedicated IAM user with only SES send plus the step 4 policy, not a personal or admin key.
- [ ] **Send from a verified domain, not Gmail.** The dev Gmail sender goes out "via amazonses.com", and Gmail put a test email in spam. Use an address on a verified domain with DKIM (for example `c4cneu.com`, already verified in SES).
- [ ] **Rotate the dev secret** if it was ever shared or pasted anywhere. Change it on both sides together.
- [ ] **Delete the dev resources** when they're no longer needed (see Cleanup).

**Known gaps (follow-up tickets)**

- [ ] **Failed sends aren't retried.** `sendNow` logs failed SES batches and returns normally (`TODO` in [notifications.service.ts](../../apps/backend/src/notifications/notifications.service.ts)), so `/send-scheduled` returns 204 and the Lambda never retries. Lambda retries cover only "backend unreachable or non-2xx".
- [ ] **One bad stored email drops its whole batch of 49.** `EmailsService` validates every Bcc address, and the DB has no email format check. Validate on write, as SSF does.
- [ ] **Retries can double-send.** A retry after a partial send repeats the earlier batches (at-least-once delivery).
- [ ] **Role gating.** Any authenticated user can call `POST /notifications`. It should be coordinators only (see the `TODO` in the controller).
- [ ] **Swap to `ArrayOverlap` when [PR #11](https://github.com/Code-4-Community/mspca/pull/11) merges.** `fosterType` becomes `FosterType[]`, and `In()` on an array column is a SQL error.
- [ ] **Email dedupe is case-sensitive** (`dup@` and `DUP@` both get Bcc'd).

**Retry budget, end to end**

| Layer               | Retries          | Configured in                               |
| ------------------- | ---------------- | ------------------------------------------- |
| Scheduler to Lambda | 2, within 10 min | `RetryPolicy` in `notifications.service.ts` |
| Lambda to backend   | 2 (async)        | step 2, `put-function-event-invoke-config`  |
| Backend to SES      | none             | known gap above                             |

If every retry fails, the failure is only logged in CloudWatch. There is no dead-letter queue.

---

## Troubleshooting

| Symptom                                         | Cause                                                             | Fix                                                                        |
| ----------------------------------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `...:iam::489...177ole/...` regex error         | zsh `:r` modifier                                                 | Use `${ACCOUNT_ID}` with braces                                            |
| `POST /notifications` with `sendAt` returns 500 | Scheduler env vars unset, or `AccessDenied` in the backend log    | Do step 5 and restart; check that the step 4 `iam:PassRole` exists         |
| Lambda: `Dispatch failed: 401`                  | Secrets differ (or, in prod, the Cognito guard)                   | Use the same secret on both sides; see the `@Public()` blocker             |
| Lambda: `Dispatch failed: 404`                  | Wrong URL path                                                    | It must end in `/api/notifications/send-scheduled`                         |
| Lambda: fetch failed / timeout                  | Tunnel or backend is down                                         | Restart them; check the URL is still current                               |
| No Lambda logs at all                           | Scheduler couldn't invoke it                                      | Check the step 3 role and the Lambda ARN in `.env`                         |
| `list-schedules`: AccessDenied                  | Your CLI user lacks Scheduler read access (not needed by the app) | Add `scheduler:ListSchedules` and `scheduler:GetSchedule` to your own user |
| `makeBuilder is not a function` on boot         | Stale Nx project graph                                            | Run `nx reset`                                                             |

## Cleanup

```bash
aws lambda delete-function --region ${AWS_REGION} --function-name mspca-notif-dispatch
aws iam detach-role-policy --role-name mspca-notif-lambda-role --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
aws iam delete-role --role-name mspca-notif-lambda-role
aws iam delete-role-policy --role-name mspca-notif-scheduler-role --policy-name invoke-notif-dispatch
aws iam delete-role --role-name mspca-notif-scheduler-role
aws iam delete-user-policy --user-name ${BACKEND_USER} --policy-name mspca-notif-create-schedules
```

## Refs

- [EventBridge Scheduler: one-time `at()` schedules](https://docs.aws.amazon.com/scheduler/latest/UserGuide/schedule-types.html#one-time)
- [Scheduler execution role](https://docs.aws.amazon.com/scheduler/latest/UserGuide/setting-up.html#setting-up-execution-role)
- [Scheduler retry policy](https://docs.aws.amazon.com/scheduler/latest/UserGuide/managing-schedule-retries.html)
- [Lambda async invocation and retries](https://docs.aws.amazon.com/lambda/latest/dg/invocation-async.html)
- [`iam:PassRole`](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_use_passrole.html)
- [SES sandbox vs production access](https://docs.aws.amazon.com/ses/latest/dg/request-production-access.html)
