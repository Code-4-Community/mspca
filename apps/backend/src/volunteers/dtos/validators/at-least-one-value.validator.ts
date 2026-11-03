import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

/**
 * Returns true if the value counts as provided: not null or undefined, and
 * not an empty array.
 */
function hasValue(value: unknown): boolean {
  if (value === null || value === undefined) {
    return false;
  }
  return !Array.isArray(value) || value.length > 0;
}

/**
 * Class decorator that rejects the DTO unless at least one of the given fields
 * has a value. A field counts as provided if it is not null or undefined, and
 * is not an empty array.
 *
 * It only checks that something was provided. The decorators on each field
 * still validate the values themselves.
 *
 * @param fields - The DTO fields to check.
 * @param validationOptions - Optional class-validator options, such as a custom message.
 */
export function AtLeastOneValue<T extends object>(
  fields: (keyof T & string)[],
  validationOptions?: ValidationOptions,
): ClassDecorator {
  return (target) => {
    registerDecorator({
      name: 'atLeastOneValue',
      target,
      // The check covers the whole DTO, so it goes on a property the DTO doesn't
      // declare. If it went on one of the fields, that field's ValidateIf would
      // skip it whenever the field was missing.
      propertyName: 'atLeastOneValue',
      options: validationOptions,
      constraints: fields,
      validator: {
        validate(_value: unknown, args: ValidationArguments): boolean {
          const dto = args.object as Record<string, unknown>;
          return fields.some((field) => hasValue(dto[field]));
        },
        defaultMessage(): string {
          return `At least one of ${fields.join(', ')} must be provided`;
        },
      },
    });
  };
}
