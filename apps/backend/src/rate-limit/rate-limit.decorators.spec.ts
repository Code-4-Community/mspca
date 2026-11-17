import { minutes } from '@nestjs/throttler';
import { RateLimit } from './rate-limit.decorators';

describe('@RateLimit()', () => {
  it('accepts a positive integer limit and ttl', () => {
    expect(() => RateLimit({ limit: 3, ttl: minutes(10) })).not.toThrow();
  });

  it.each([1.5, 0])('throws when limit is %p', (limit) => {
    expect(() => RateLimit({ limit, ttl: minutes(1) })).toThrow(
      new Error(
        `@RateLimit(): limit must be a positive integer, received ${String(
          limit,
        )}`,
      ),
    );
  });

  it.each([1.5, 0])('throws when ttl is %p', (ttl) => {
    expect(() => RateLimit({ limit: 1, ttl })).toThrow(
      new Error(
        `@RateLimit(): ttl must be a positive integer, received ${String(ttl)}`,
      ),
    );
  });

  it('throws as soon as a class using an invalid limit is defined', () => {
    expect(() => {
      class InvalidController {
        @RateLimit({ limit: 2.5, ttl: minutes(1) })
        handler(): string {
          return 'ok';
        }
      }
      return InvalidController;
    }).toThrow(
      new Error('@RateLimit(): limit must be a positive integer, received 2.5'),
    );
  });
});
