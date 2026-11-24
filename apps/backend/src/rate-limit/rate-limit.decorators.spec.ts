import { minutes } from '@nestjs/throttler';
import { RateLimit } from './rate-limit.decorators';

describe('@RateLimit()', () => {
  it('accepts a positive integer limit and a positive ttl', () => {
    expect(() => RateLimit({ limit: 3, ttl: 1500.5 })).not.toThrow();
  });

  it('throws when limit is invalid', () => {
    expect(() => RateLimit({ limit: 1.5, ttl: minutes(1) })).toThrow(
      new Error(
        'Invalid rate limit: limit must be a positive integer, received 1.5',
      ),
    );
  });

  it('throws when ttl is invalid', () => {
    expect(() => RateLimit({ limit: 1, ttl: 0 })).toThrow(
      new Error(
        'Invalid rate limit: ttl must be a positive number, received 0',
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
      new Error(
        'Invalid rate limit: limit must be a positive integer, received 2.5',
      ),
    );
  });
});
