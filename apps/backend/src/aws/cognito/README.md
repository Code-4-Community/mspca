## Scaffolding auth flow

Some key concepts you'll need to know are:

- **Authentication (authn)** = _"who are you?"_ -> ex: distinguishing a known user from an unknown one
- **Authorization (authz)** = _"what are you allowed to do?"_ -> ex: distinguishing admin access vs normal user access to routes

1. **Unauthenticated user hits the app.** A user opens the frontend with no token. If they call a protected (Non Public) backend route, `CognitoJWTGuard` finds no `Authorization: Bearer <token>` header and responds `401 Unauthorized`.

2. **User authenticates with Cognito** The frontend sends the user's credentials to Cognito. Cognito verifies the credentials and _authenticates_ the user. This happens entirely between the client and Cognito. Our backend is not involved and never sees the password.

   - On the frontend this login flow is run by [AWS Amplify](https://docs.amplify.aws/). If auth is enabled, `apps/frontend/src/auth/auth.config.ts` (`configureAmplify()`) points Amplify at the user pool, and `apps/frontend/src/main.tsx` wraps the app in Amplify's `<Authenticator>` login gate.

3. **Cognito issues tokens.** On success, Cognito returns separate signed JWTs for the following:

   - **ID token**: describes _who the user is_ (identity claims), meant for the frontend.
   - **access token**: the _authorization_ credential, meant to be sent to backend APIs and checked by the `CognitoJWTGuard`. (See [Token validation](#token-validation))
   - **refresh token**: used to obtain fresh ID/access tokens when they expire.

4. **Frontend calls the backend with the access token.** The client attaches it on every request as a header: `Authorization: Bearer <access_token>`. This is done once, by an axios request interceptor in `apps/frontend/src/api/apiClient.ts`, so individual API methods never deal with tokens:

   - it only sends the request with the access token when auth is enabled, so the scaffold still runs with no Cognito setup
   - `fetchAuthSession()` returns the cached access token and silently refreshes it when expired, so the 1 hour token lifetime needs no handling
   - if no one is signed in or if errors occur with fetching the auth session it sends the request unauthenticated and lets the guard answer `401`

5. **The Guard checks the token.** `CognitoJWTGuard` runs on every route: the app's global guard, `AuthThenRateLimitGuard`, calls it first and then applies rate limiting (see [Rate limiting](#rate-limiting)). For each request it:

   - lets the request through immediately if auth is explicitly disabled (`AUTH_DISABLED=true`) or if the route is marked `@Public()` (intentional bypass)
   - extracts and verifies the Bearer token, then checks the RS256 signature against the pool's public keys (JWKS), the issuer, expiration, that `token_use === 'access'`, and that `client_id` matches our app client.

6. **Allow or deny.**
   - **Valid token** → the guard attaches the decoded claims to `request.user` and the request proceeds to the controller -> Read with `CognitoService.getUser(req)`.
   - **Missing or invalid token** (bad signature, expired, wrong token type, wrong client) → `401 Unauthorized`, and the controller never runs. The guard logs the specific rejection reason server-side (e.g. `Token verification failed: jwt expired`), but the client always receives a generic `401 Unauthorized` except when the request has no Bearer token at all, in which case the response carries the message `No bearer token provided`.

So: **every route is protected by default, a request is allowed only if it carries a valid Cognito access token or if the route is marked `@Public()`, which skips the check entirely.** Public routes are for things that must work without a login, like health checks, webhooks, or the login entry point itself.

## QUICKSTART:

Copy placeholders from the repo root `example.env` into `.env` (or your deployment secrets). The `COGNITO_*` variables drive **both** the backend and the frontend:

| Variable               | Purpose                                                                                                                                                                                                                             |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AUTH_DISABLED`        | Set to `true` to run with **no authentication at all** (**required** unless the `COGNITO_*` variables below are set). Only `true` and `false` are accepted. Never `true` in a deployed environment.                                 |
| `COGNITO_USER_POOL_ID` | Your registered users in Cognito to authenticate with (**required** unless `AUTH_DISABLED=true`)                                                                                                                                    |
| `COGNITO_CLIENT_ID`    | The application you are building's own id linked to Cognito used to validate `client_id` on tokens (**required** unless `AUTH_DISABLED=true`)                                                                                       |
| `COGNITO_REGION`       | AWS region (**optional**) — when unset it is derived from the user pool ID, which is formatted `<region>_<id>` (e.g. `us-east-2_abc123` → `us-east-2`). Set it explicitly only if your pool ID does not encode the region you want. |

`apps/frontend/vite.config.ts` re-exports the same values to the client bundle as `VITE_COGNITO_USER_POOL_ID`, `VITE_COGNITO_USER_POOL_CLIENT_ID`, and `VITE_COGNITO_REGION` at build time, so the client and server always share one source of truth (you never set the `VITE_` variables by hand). Because both sides read the same values, they can't drift out of sync: set the user pool ID and client ID and auth is enforced on the backend _and_ the login UI appears on the frontend.

> [!IMPORTANT] > **Running with auth off requires an explicit opt-in.** `AUTH_DISABLED=true` is the only thing that turns JWT enforcement off. Anything else that leaves the Cognito config unusable is treated as a misconfiguration and the application **refuses to start**

> [!WARNING]
> Disabling auth is a convenience for local development, **not** a safe production state. `example.env` ships with `AUTH_DISABLED=true` so that a fresh clone runs without any Cognito setup — remove it (or set it to `false`) as soon as you wire up a real user pool, and make sure it is never set in a deployed environment. If Cognito variables are present _and_ `AUTH_DISABLED=true`, `CognitoModule` emits a second warning that the configuration is being ignored, which is the case worth grepping deploy logs for.
> The frontend deliberately does **not** have a mirror of this flag as the security boundary is entirely server-side and it cannot enforce anything

## `AUTH_DISABLED`

The flag that gates the startup configuration check.

Auth is opt-**out** because its disabled state _is_ the vulnerability: every route served unauthenticated.

`CognitoModule.onModuleInit` **throws** `AuthConfigurationError` naming every missing variable, and the module lets it propagate so `main.ts` fails and the process exits.

`CognitoJWTGuard` reads a `null` config as "let this request through", and `getCognitoConfig()` returns `null` if and only if `AUTH_DISABLED=true`.

### Adding a required Cognito env var

Add its name to `REQUIRED_ENV_VARS_WHEN_ENABLED` in `cognito.config.ts`:

```ts
export const REQUIRED_ENV_VARS_WHEN_ENABLED = ['COGNITO_USER_POOL_ID', 'COGNITO_CLIENT_ID', 'COGNITO_MY_NEW_VAR'] as const;
```

### Auth model

- **Verification** — `CognitoJWTGuard` is the only component that validates JWTs (See [Token validation](#token-validation))
- **Global guard** — `CognitoModule` registers `AuthThenRateLimitGuard` as the app's only `APP_GUARD`. It runs `CognitoJWTGuard`, then `RateLimitGuard`, so every route is protected and rate limited by default. You do **not** need `@UseGuards(...)` on controllers.
- **`request.user`** — After a successful check, the guard sets `request.user` to the decoded JWT payload (`AccessTokenPayload`: `sub`, `client_id`, `cognito:groups`, `token_use`, etc.)

### Using Cognito in your app (recommended + implemented: global guard)

`CognitoModule` is already imported into `AppModule`, so there is nothing to wire up. That import is what enables auth app-wide and exports `CognitoService` for reading `request.user`:

> [!IMPORTANT]
> Note: This has already been implemented by default

```typescript
@Module({
  imports: [TypeOrmModule.forRoot(...), CognitoModule],
})
export class AppModule {}
```

New controllers are protected automatically. Opt out with `@Public()` (see below). Read the caller with `CognitoService.getUser(req)` or `req.user` after the guard runs.

### Public Routes

Use the `@Public()` decorator on routes that are technically protected, but don't require authentication. i.e. health checks, webhooks, or unauthenticated entry points:

```typescript
import { Public } from './aws/cognito/cognito.decorator';

@Controller('health')
export class HealthController {
  @Public()
  @Get()
  check() {
    return { ok: true };
  }
}
```

### Rate limiting

Every route is rate limited, using [`@nestjs/throttler`](https://github.com/nestjs/throttler). Requests over the limit receive `429 Too Many Requests`.

#### Defaults

| Route type           | Default limit  | Counted per                                                                |
| -------------------- | -------------- | -------------------------------------------------------------------------- |
| Public (`@Public()`) | 10 per minute  | Client IP address                                                          |
| Protected            | 100 per minute | Logged-in Cognito user (`sub` claim); IP address when `AUTH_DISABLED=true` |

Public routes are keyed by IP because there's no logged-in user, and on sign-up routes the email is chosen by the caller, so a bot could use a new one on every request. Protected routes are keyed by user, so people sharing a network (for example, a shelter's Wi-Fi) each get their own limit.

#### Custom limits and opting out

Use the wrappers in `rate-limit/rate-limit.decorators.ts`:

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

- `limit` and `ttl` (the window, in milliseconds) must be positive integers. An invalid value throws at startup, so the app won't boot with a broken limit.
- Don't use the package's `@Throttle()` or `@SkipThrottle()` directly. The two throttlers are named (`public` and `protected`), and with named throttlers a bare `@SkipThrottle()` skips nothing. The wrappers always pass both names.

Current custom limits:

| Route                                                    | Limit            |
| -------------------------------------------------------- | ---------------- |
| `POST /volunteers`, `POST /coordinators`                 | 3 per 10 minutes |
| `POST /volunteers/confirm`, `POST /coordinators/confirm` | 5 per 10 minutes |

Account creation is strictest because every call makes Cognito send a verification email. On the confirm routes, a 429 can come from this rate limit or from Cognito's own limit on wrong codes; clients should treat both as "try again later."

#### How it works

- `rate-limit/rate-limit.utils.ts` defines the two throttlers (`DEFAULT_THROTTLERS`), their names, and `isPublicRoute()`. Each throttler skips the other route type, so every route uses exactly one.
- `rate-limit/rate-limit.guard.ts` (`RateLimitGuard`) extends `ThrottlerGuard` and overrides `getTracker()` to count by `request.user.sub` when present, otherwise by IP.
- `rate-limit/auth-then-rate-limit.guard.ts` (`AuthThenRateLimitGuard`) is the single global guard. It runs `CognitoJWTGuard`, then `RateLimitGuard`. The order matters, since `request.user` only exists after authentication, and registering the two as separate global guards did not keep that order in practice. Unauthenticated requests get `401` before rate limiting runs.
- `CognitoModule` imports `ThrottlerModule.forRoot(DEFAULT_THROTTLERS)` itself, so the module provides everything its guards need.
- Requests are counted per route: an IP's sign-up attempts and confirmation attempts are tracked separately.

#### Testing

- `rate-limit.guard.spec.ts` runs a small app with the real `AuthThenRateLimitGuard` and a `FakeAuthGuard` standing in for `CognitoJWTGuard`, covering both defaults, custom limits (under, at, and over), skipping, and keying by IP vs. user.
- `auth-then-rate-limit.guard.spec.ts` checks that authentication runs first and that failed authentication skips rate limiting.
- `rate-limit.decorators.spec.ts` and `rate-limit.utils.spec.ts` cover validation and `isPublicRoute()`.
- Controller unit tests need no setup for rate limiting, since the global guard isn't created in them.

To test with real users locally, set `AUTH_DISABLED=false`, then get access tokens with `aws cognito-idp initiate-auth` (`USER_PASSWORD_AUTH` flow) for two users. One user going over a limit shouldn't affect the other.

#### Limitations and deployment notes

- **Counts are stored in memory.** They reset when the server restarts and aren't shared between instances. That works for a single long-running server. On AWS Lambda, each execution environment keeps its own counts, so limits become best-effort. A shared store such as Redis would fix this, at extra cost.
- **The client IP must be correct behind a proxy.** Behind API Gateway or another proxy, `req.ip` may be the proxy's address, which would put all anonymous users on one counter. Verify `req.ip` once deployment is set up and configure Express's `trust proxy` setting (or the Lambda adapter) as needed. Don't enable `trust proxy` without a proxy in front, since clients could then fake `X-Forwarded-For`.
- **Infrastructure-level options (not yet decided):** an AWS WAF rate-based rule (per-IP, before requests reach the app; about $5/month per web ACL plus $1 per rule and $0.60 per million requests; minimum limit of 10 per window) and API Gateway throttling (a cap on total traffic, shared by all callers). The in-app limits work without either.

### `CognitoService.getUser()`

Inject `CognitoService` to extract the same `AccessTokenPayload` decoded token payload the guard attached to `request.user`:

```typescript
@Get('me')
me(@Req() req: Request) {
  const user = this.cognitoService.getUser(req);
  // null when auth is disabled via AUTH_DISABLED=true, or when request.user was never set
  return user;
}
```

Returns `null` if Cognito auth is disabled (`AUTH_DISABLED=true`) or if no verified token was attached. On protected routes with a valid Bearer token, it returns the JWT claims object.

## Token validation

The guard validates access tokens by

- JWKS: https://cognito-idp.{region}.amazonaws.com/{userPoolId}/.well-known/jwks.json
- Signature: RS256; iss must match the pool.
- Expiration: exp is enforced automatically by jsonwebtoken.verify
- token_use: must equal `access`. This is what rejects an ID token presented to the backend.
- client_id: must equal `COGNITO_CLIENT_ID`. On access tokens the app client ID lives in the client_id claim
- payload shape: `isAccessTokenPayload` rejects the token unless the required claims are present and well-typed — `sub`/`iss` are strings, `token_use === 'access'`, `client_id` is a string, `exp`/`iat` are numbers, and `cognito:groups` (if present) is an array of strings.

> [!IMPORTANT]
> The scaffold accepts access tokens only by design. Backend APIs are resource servers and authorize requests using access tokens; ID tokens are for the frontend to establish who the user is.

> [!WARNING]
> Common Confusion: Do not use the ID token for API authorization. ID tokens are intended for your client application to establish who the user is; passing them to a backend API exposes identity claims unnecessarily and confuses authentication with authorization. Backend APIs should validate access tokens only.

In `cognito.guard.ts`, `isAccessTokenPayload` validates the token type and claim shape, and the guard then checks the client id against the configured `COGNITO_CLIENT_ID`:

```typescript
// isAccessTokenPayload(...) rejects anything where token_use !== 'access'
// (alongside the other claim-shape checks), then the guard verifies:
if (payload.client_id !== config.clientId) {
  throw new UnauthorizedException();
}
```

> [!NOTE] > `client_id` validation currently accepts a single client. If this pool ever serves
> multiple app clients (e.g. a separate web and mobile app sharing one user pool),
> change COGNITO_CLIENT_ID to accept a comma-separated list and validate membership
> in that allowlist instead of simply an equality check.

## Helpful Resources for understanding Auth!

- The most amazing explanation of authn (OAUTH 2.0) and authz (OIDC) you'll ever watch: https://www.youtube.com/watch?v=996OiexHze0&t=2126s
- Difference between id and access tokens: https://auth0.com/blog/id-token-access-token-what-is-the-difference/
- Using AWS to verify JWT: https://docs.aws.amazon.com/cognito/latest/developerguide/amazon-cognito-user-pools-using-tokens-verifying-a-jwt.html
