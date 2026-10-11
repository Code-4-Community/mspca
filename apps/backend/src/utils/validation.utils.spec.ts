import { BadRequestException } from '@nestjs/common';
import { validateId } from './validation.utils';

describe('validateId', () => {
  it('should not throw an error for a valid ID', () => {
    expect(() => validateId(5, 'User')).not.toThrow();
  });

  it('should throw BadRequestException for ID < 1', () => {
    expect(() => validateId(0, 'User')).toThrow(
      new BadRequestException('Invalid User ID'),
    );
  });

  it('should throw BadRequestException for a non-integer ID', () => {
    expect(() => validateId(1.5, 'User')).toThrow(
      new BadRequestException('Invalid User ID'),
    );
  });

  it('should throw BadRequestException for a missing ID', () => {
    expect(() => validateId(undefined as unknown as number, 'User')).toThrow(
      new BadRequestException('Invalid User ID'),
    );
  });
});
