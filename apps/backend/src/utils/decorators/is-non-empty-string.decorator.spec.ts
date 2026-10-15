import { plainToInstance } from 'class-transformer';
import { IsOptional, validate } from 'class-validator';
import { IsNonEmptyString } from './is-non-empty-string.decorator';

class TestDto {
  @IsNonEmptyString()
  name!: unknown;
}

class OptionalTestDto {
  @IsOptional()
  @IsNonEmptyString()
  name?: unknown;
}

// Mirrors what the global ValidationPipe does with `transform: true`.
const transformAndValidate = async <T extends object>(
  cls: new () => T,
  body: object,
) => {
  const instance = plainToInstance(cls, body);
  const errors = await validate(instance);
  return { instance, errors };
};

describe('IsNonEmptyString', () => {
  it('accepts a normal string unchanged', async () => {
    const { instance, errors } = await transformAndValidate(TestDto, {
      name: 'Jane',
    });

    expect(errors).toHaveLength(0);
    expect(instance.name).toBe('Jane');
  });

  it('trims surrounding whitespace from a padded string', async () => {
    const { instance, errors } = await transformAndValidate(TestDto, {
      name: '  Jane  ',
    });

    expect(errors).toHaveLength(0);
    expect(instance.name).toBe('Jane');
  });

  it.each(['   ', ''])(
    'rejects a whitespace-only or empty string: %j',
    async (name) => {
      const { errors } = await transformAndValidate(TestDto, { name });

      expect(errors).toHaveLength(1);
      expect(errors[0].constraints).toHaveProperty('isNotEmpty');
    },
  );

  it.each([123, true, ['a']])(
    'rejects a non-string value without throwing: %j',
    async (name) => {
      const { instance, errors } = await transformAndValidate(TestDto, {
        name,
      });

      expect(instance.name).toEqual(name);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints).toHaveProperty('isString');
    },
  );

  it('allows the field to be left out when combined with IsOptional', async () => {
    const { errors } = await transformAndValidate(OptionalTestDto, {});

    expect(errors).toHaveLength(0);
  });

  it('still rejects a whitespace-only string when combined with IsOptional', async () => {
    const { errors } = await transformAndValidate(OptionalTestDto, {
      name: '   ',
    });

    expect(errors).toHaveLength(1);
    expect(errors[0].constraints).toHaveProperty('isNotEmpty');
  });
});
