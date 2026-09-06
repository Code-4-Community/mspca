# AWS S3 Module

A global NestJS module providing S3 file upload and retrieval via `AWSS3Service`.

## Setup

Add these variables to `.env` and `example.env`:

```
S3_ENABLED=true
AWS_REGION=us-east-2
AWS_ACCESS_KEY_ID=your-access-key-id
AWS_SECRET_ACCESS_KEY=your-secret-access-key
# one entry per bucket — see "Adding a New Bucket" below
AWS_MY_BUCKET_NAME=my-bucket-name
```

`AWS_REGION`, `AWS_ACCESS_KEY_ID`, and `AWS_SECRET_ACCESS_KEY` are shared across every AWS module in this app (S3, SES, …) and use the AWS SDK's standard names — define them once and don't rename them per-service. Only `S3_ENABLED` and the bucket vars are S3-specific.

Import `AWSS3Module` once in your root `AppModule`. Because the module is `@Global()`, `AWSS3Service` is injectable in all feature modules without additional imports.

Every bucket env var **must** follow the `AWS_<BUCKET>_BUCKET_NAME` format, where `<BUCKET>` is the `S3Buckets` enum member verbatim. `AWSS3Service` builds its bucket lookup from that convention, so a name that doesn't match will never be found.

## `S3_ENABLED`

`S3_ENABLED` gates the startup config check.SES_ENABLED When it is anything other than `'true'` (case-insensitive), `AWSS3Module.onModuleInit` skips validation entirely and logs `S3 disabled: …`, so a project that doesn't use S3 boots without AWS config and without a warning on every startup.

When it is `'true'`, `onModuleInit` logs a warning listing any env var in its `REQUIRED_ENV_VARS_WHEN_ENABLED` list that is unset or blank.

The flag only controls that check — it does not disable `AWSS3Service`. Calls to `upload()` / `getImageData()` still reach AWS and fail there if credentials are absent.

## Adding a New Bucket

**1. Add an env var** in `.env` and `example.env`, named `AWS_<BUCKET>_BUCKET_NAME`:

```
AWS_MY_BUCKET_NAME=my-bucket-name
```

**2. Add an entry to the `S3Buckets` enum** (`types/s3Buckets.ts`), matching the middle of that env var name:

```typescript
export enum S3Buckets {
  MY_BUCKET = 'MY_BUCKET',
}
```

**3. Add the env var name to `REQUIRED_ENV_VARS_WHEN_ENABLED`** (`aws-s3.module.ts`), so a missing value is reported at startup when `S3_ENABLED=true`:

```typescript
const REQUIRED_ENV_VARS_WHEN_ENABLED = ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_MY_BUCKET_NAME'] as const;
```

No change to `aws-s3.service.ts` is needed: its constructor resolves `process.env['AWS_' + bucket + '_BUCKET_NAME']` for every member of `S3Buckets`. A bucket whose env var is missing resolves to `''`, and any `upload()` to it throws `Missing required environment variable for S3 bucket: MY_BUCKET`.

## Required IAM Permissions

The credentials supplied via `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` must have:

| Permission     | Required by      |
| -------------- | ---------------- |
| `s3:PutObject` | `upload()`       |
| `s3:GetObject` | `getImageData()` |

Scope permissions to only the buckets this application uses:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject"],
      "Resource": ["arn:aws:s3:::your-bucket-name/*"]
    }
  ]
}
```
