import { registerDecorator, ValidationArguments } from 'class-validator';

/**
 * Class decorator that rejects the DTO unless exactly one of the given fields
 * is provided (i.e. not undefined).
 *
 * It only checks presence. The decorators on each field still validate the
 * values themselves.
 */
export function ExactlyOne<T extends object>(
  fields: (keyof T & string)[],
): ClassDecorator {
  return (target) => {
    registerDecorator({
      name: 'exactlyOne',
      target,
      propertyName: 'exactlyOne',
      validator: {
        validate(_: unknown, args: ValidationArguments): boolean {
          const dto = args.object as Record<string, unknown>;
          return fields.filter((f) => dto[f] !== undefined).length === 1;
        },
        defaultMessage(): string {
          return `Exactly one of ${fields.join(', ')} must be provided`;
        },
      },
    });
  };
}
