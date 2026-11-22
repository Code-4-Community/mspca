# Rate limiting

Every route is rate limited using [`@nestjs/throttler`](https://github.com/nestjs/throttler). Requests over the limit receive `429 Too Many Requests`.

## Defaults

| Route type           | Default limit  | Counted per                                                                                                    |
| -------------------- | -------------- | -------------------------------------------------------------------------------------------------------------- |
| Public (`@Public()`) | 10 per minute  | Client IP address                                                                                              |
| Protected            | 100 per minute | Logged-in Cognito user (`sub` claim). IP address when the request fails authentication or `AUTH_DISABLED=true` |

Public routes are counted by IP because there's no logged-in user, and on sign-up routes the email is chosen by the caller, so a bot could use a new one on every request. Protected routes are counted by user, so people sharing a network (for example, a shelter's Wi-Fi) each get their own limit.

Requests are counted per route: an IP's sign-up attempts and confirmation attempts are tracked separately.

## Custom limits and opting out

Use the decorators in `rate-limit.decorators.ts`:

```typescript
import { minutes } from '@nestjs/throttler';
import { RateLimit, SkipRateLimit } from '../rate-limit/rate-limit.decorators';

@Post()
@Public()
@RateLimit({ limit: 3, ttl: minutes(10) }) // 3 requests per 10 minutes
create() {}

@Get('health')
@SkipRateLimit() // never rate limited
check() {}
```

- `limit` must be a positive integer. `ttl` is the window length in milliseconds and must be a positive number; use the `minutes()` / `seconds()` helpers. An invalid value throws when the app starts, so it won't boot with a broken limit.
- Prefer these over the package's `@Throttle()` and `@SkipThrottle()`, so every custom limit gets validated.

Current custom limits:

| Route                                                    | Limit            |
| -------------------------------------------------------- | ---------------- |
| `POST /volunteers`, `POST /coordinators`                 | 3 per 10 minutes |
| `POST /volunteers/confirm`, `POST /coordinators/confirm` | 5 per 10 minutes |

Account creation is strictest because every call makes Cognito send a verification email. On the confirm routes, a 429 can come from this rate limit or from Cognito's own limit on wrong codes; clients should treat both as "try again later."

## How a request is handled

1. `AuthThenRateLimitGuard`, the app's only global guard, runs `CognitoJWTGuard`.
2. **If authentication succeeds**, it runs `RateLimitGuard`, which counts the request under the user's ID (or under the IP on public routes, and when auth is disabled). Over the limit returns `429`.
3. **If authentication fails**, it still runs `RateLimitGuard`, which counts the request by IP since there's no user. Under the limit, the original `401` is returned. Over the limit returns `429`, so spam with missing or invalid tokens gets cut off too.

Authentication must run first: `request.user` only exists after `CognitoJWTGuard` verifies the token, and registering the two as separate global guards did not keep that order in practice.

## Files

| File                            | What it does                                                                                                                                                                                                                            |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `rate-limit.utils.ts`           | The default limits (`PUBLIC_DEFAULT_LIMIT`, `PROTECTED_DEFAULT_LIMIT`) and `DEFAULT_THROTTLERS`: a single throttler whose limit depends on the route type, using `isPublicRoute()`. Also the validation helpers used by `@RateLimit()`. |
| `rate-limit.decorators.ts`      | `@RateLimit()` and `@SkipRateLimit()`.                                                                                                                                                                                                  |
| `rate-limit.guard.ts`           | `RateLimitGuard`, which extends `ThrottlerGuard` and overrides `getTracker()` to count by `user:<sub>` or `ip:<address>`.                                                                                                               |
| `auth-then-rate-limit.guard.ts` | `AuthThenRateLimitGuard`, which runs authentication and rate limiting in order (see above).                                                                                                                                             |

`CognitoModule` wires these up: it imports `ThrottlerModule.forRoot(DEFAULT_THROTTLERS)`, provides both guards, and registers `AuthThenRateLimitGuard` as the global guard.

## Testing

- `rate-limit.guard.spec.ts` runs a small app with the real `AuthThenRateLimitGuard`, and a `FakeAuthGuard` standing in for `CognitoJWTGuard`. Tests act as a logged-in user with the `x-test-user` header, or fail authentication with `x-test-auth-fail`. It covers both defaults, custom limits (under, at, and over), skipping, counting by IP vs. user, failed authentications, and the missing-IP case.
- `auth-then-rate-limit.guard.spec.ts` checks the order and each pass/fail combination of the two guards.
- `rate-limit.decorators.spec.ts` and `rate-limit.utils.spec.ts` cover validation and `isPublicRoute()`.
- Controller unit tests need no setup for rate limiting, since the global guard isn't created in them.

To test against the running app, set `AUTH_DISABLED=false` and start the backend:

- Sending 101 requests with an invalid token to a protected route should return 100 × `401`, then `429`.
- For per-user limits, get access tokens for two users with `aws cognito-idp initiate-auth` (`USER_PASSWORD_AUTH` flow). One user going over a limit shouldn't affect the other.

## Limitations and deployment notes

- **Counts are stored in memory.** They reset when the server restarts and aren't shared between instances. That works for a single long-running server. On AWS Lambda, each execution environment keeps its own counts, so limits become best-effort. A shared store such as Redis would fix this, at extra cost.
- **The client IP must be correct behind a proxy.** Behind API Gateway or another proxy, `req.ip` may be the proxy's address, which would put all anonymous users on one counter. If `req.ip` is missing entirely, requests share the key `ip:unknown` and `RateLimitGuard` logs a warning. Verify `req.ip` once deployment is set up, and configure Express's `trust proxy` setting (or the Lambda adapter) as needed. Don't enable `trust proxy` without a proxy in front, since clients could then fake `X-Forwarded-For`.
- **Infrastructure-level options (not yet decided):** an AWS WAF rate-based rule (per-IP, before requests reach the app; about $5/month per web ACL plus $1 per rule and $0.60 per million requests; minimum limit of 10 per window) and API Gateway throttling (a cap on total traffic, shared by all callers). The in-app limits work without either.
