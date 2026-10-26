import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

export function AtLeastOneFosterTypePreference(
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'atLeastOneFosterTypePreference',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(_value: unknown, args: ValidationArguments): boolean {
          const dto = args.object as {
            added?: unknown;
            removed?: unknown;
          };

          return (
            (Array.isArray(dto.added) && dto.added.length > 0) ||
            (Array.isArray(dto.removed) && dto.removed.length > 0)
          );
        },
        defaultMessage(): string {
          return 'At least one of added or removed must be provided';
        },
      },
    });
  };
}
