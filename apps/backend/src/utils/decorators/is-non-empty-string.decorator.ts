import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString } from 'class-validator';

/**
 * Validates that a field is a non-empty string, trimming surrounding whitespace first.
 *
 * Combines IsString and IsNotEmpty with a Transform that trims the value, so a
 * whitespace-only string is rejected and padded strings arrive trimmed. Non-string
 * values are passed through untouched so that IsString reports them, instead of the
 * trim throwing an error.
 *
 * Requires `transform: true` on the ValidationPipe for the trim to apply.
 */
export function IsNonEmptyString(): PropertyDecorator {
  return applyDecorators(
    Transform(({ value }) =>
      typeof value === 'string' ? value.trim() : value,
    ),
    IsString(),
    IsNotEmpty(),
  );
}
