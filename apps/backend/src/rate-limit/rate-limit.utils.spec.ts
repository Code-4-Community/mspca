import { Controller, ExecutionContext, Get } from '@nestjs/common';
import { Public } from '../aws/cognito/cognito.decorator';
import { isPublicRoute } from './rate-limit.utils';

@Public()
@Controller()
class PublicController {
  @Get()
  handler(): string {
    return 'ok';
  }
}

@Controller()
class MixedController {
  @Get('public')
  @Public()
  publicHandler(): string {
    return 'ok';
  }

  @Get('protected')
  protectedHandler(): string {
    return 'ok';
  }
}

/**
 * Builds the parts of an ExecutionContext that isPublicRoute reads.
 *
 * @param controller - The controller class.
 * @param handler - The route handler method.
 * @returns A minimal ExecutionContext for that route.
 */
function contextFor(controller: object, handler: object): ExecutionContext {
  return {
    getClass: () => controller,
    getHandler: () => handler,
  } as unknown as ExecutionContext;
}

describe('isPublicRoute', () => {
  it('returns true for a handler marked @Public()', () => {
    const context = contextFor(
      MixedController,
      MixedController.prototype.publicHandler,
    );

    expect(isPublicRoute(context)).toBe(true);
  });

  it('returns true for a handler whose controller is marked @Public()', () => {
    const context = contextFor(
      PublicController,
      PublicController.prototype.handler,
    );

    expect(isPublicRoute(context)).toBe(true);
  });

  it('returns false for a route without @Public()', () => {
    const context = contextFor(
      MixedController,
      MixedController.prototype.protectedHandler,
    );

    expect(isPublicRoute(context)).toBe(false);
  });
});
