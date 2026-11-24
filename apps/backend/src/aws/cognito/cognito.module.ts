import { Global, Module, OnModuleInit, Logger } from '@nestjs/common';
import { CognitoJWTGuard } from './cognito.guard';
import { APP_GUARD } from '@nestjs/core';
import { CognitoService } from './cognito.service';
import {
  getCognitoConfig,
  hasAnyCognitoEnv,
  isAuthDisabled,
} from './cognito.config';
import { ThrottlerModule } from '@nestjs/throttler';
import { RateLimitGuard } from '../../rate-limit/rate-limit.guard';
import { DEFAULT_THROTTLERS } from '../../rate-limit/rate-limit.utils';
import { AuthThenRateLimitGuard } from '../../rate-limit/auth-then-rate-limit.guard';

@Global()
@Module({
  // RateLimitGuard needs the throttler settings, so this module provides them itself.
  imports: [ThrottlerModule.forRoot(DEFAULT_THROTTLERS)],
  providers: [
    CognitoService,
    CognitoJWTGuard,
    RateLimitGuard,
    // One global guard so auth always runs before rate limiting; see auth-then-rate-limit.guard.ts.
    { provide: APP_GUARD, useClass: AuthThenRateLimitGuard },
  ],
  exports: [CognitoService],
})
export class CognitoModule implements OnModuleInit {
  private readonly logger = new Logger(CognitoModule.name);

  /**
   * Reports the resolved auth mode at startup.
   *
   * `getCognitoConfig()` throws an `AuthConfigurationError` when the Cognito configuration is unusable and `AUTH_DISABLED=true` was not set.
   * Process exits instead of coming up with every route unauthenticated.
   */
  onModuleInit(): void {
    // Auth explicitly disabled: skip validation entirely
    if (isAuthDisabled()) {
      this.logger.warn(
        'Cognito auth disabled via AUTH_DISABLED=true. All routes are open and ' +
          'no bearer token is verified. This must never be set in a deployed ' +
          'environment.',
      );
      if (hasAnyCognitoEnv()) {
        this.logger.warn(
          'COGNITO_* environment variables are set but ignored because ' +
            'AUTH_DISABLED=true. Remove AUTH_DISABLED (or set it to false) to ' +
            'enforce authentication.',
        );
      }
      return;
    }

    // Auth is enabled, so the configuration has to be complete.
    // getCognitoConfig() throws AuthConfigurationError if the configuration is unusable.
    // See REQUIRED_ENV_VARS_WHEN_ENABLED in cognito.config.ts for the list of required variables.
    getCognitoConfig();
    this.logger.log(`Cognito auth enabled`);
  }
}
