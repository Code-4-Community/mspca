import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

/**
 * Checks whether a DTO field counts as provided.
 *
 * A field counts as provided unless it is undefined. Empty arrays are treated
 * as provided only for fields explicitly allowed via the decorator options.
 * null counts as provided, so optional fields sent as null are accepted here;
 * the decorators on the field itself decide whether null is actually allowed.
 *
 * @param value - The value of the DTO field.
 * @param allowEmptyArray - Whether an empty array should count as provided.
 * @returns True if the value counts as provided, false otherwise.
 */
function hasValue(value: unknown, allowEmptyArray = false): boolean {
  if (value === undefined) {
    return false;
  }
  return !Array.isArray(value) || allowEmptyArray || value.length > 0;
}

/**
 * Class decorator that rejects the DTO unless at least one of the given fields
 * has a value. Empty arrays can be treated as provided for specific fields when
 * clearing a list is a meaningful update.
 *
 * It only checks that something was provided. The decorators on each field
 * still validate the values themselves.
 *
 * @param fields - The DTO fields to check.
 * @param validationOptions - Optional class-validator options, such as a custom message.
 * @param allowEmptyArrayFields - DTO fields whose empty arrays count as provided.
 * @returns A class decorator that registers the check on the DTO.
 */
export function AtLeastOneValue<T extends object>(
  fields: (keyof T & string)[],
  validationOptions?: ValidationOptions,
  allowEmptyArrayFields: (keyof T & string)[] = [],
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
          return fields.some((field) => {
            const value = dto[field];
            return hasValue(
              value,
              allowEmptyArrayFields.includes(field as keyof T & string),
            );
          });
        },
        defaultMessage(): string {
          return `At least one of ${fields.join(', ')} must be provided`;
        },
      },
    });
  };
}
