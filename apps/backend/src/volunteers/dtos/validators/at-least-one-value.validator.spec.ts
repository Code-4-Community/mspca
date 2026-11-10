import { validate } from 'class-validator';
import { AtLeastOneValue } from './at-least-one-value.validator';
import { UpdateVolunteerDto } from '../update-volunteer.dto';

@AtLeastOneValue<TestDto>(['added', 'removed'])
class TestDto {
  added?: string[] | null;
  removed?: string[] | null;
}

describe('AtLeastOneValue', () => {
  it('passes when added contains a value', async () => {
    const dto = Object.assign(new TestDto(), {
      added: ['DOG'],
    });

    expect(await validate(dto)).toHaveLength(0);
  });

  it('passes when removed contains a value', async () => {
    const dto = Object.assign(new TestDto(), {
      removed: ['CAT'],
    });

    expect(await validate(dto)).toHaveLength(0);
  });

  it('passes when both arrays contain values', async () => {
    const dto = Object.assign(new TestDto(), {
      added: ['DOG'],
      removed: ['CAT'],
    });

    expect(await validate(dto)).toHaveLength(0);
  });

  it('fails when both arrays are missing', async () => {
    const errors = await validate(new TestDto());

    expect(errors).toHaveLength(1);
    expect(errors[0].constraints).toEqual({
      atLeastOneValue: 'At least one of added, removed must be provided',
    });
  });

  it('fails when both arrays are empty', async () => {
    const dto = Object.assign(new TestDto(), {
      added: [],
      removed: [],
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(1);
  });

  it('fails when one array is empty and the other is missing', async () => {
    const dto = Object.assign(new TestDto(), {
      added: [],
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(1);
  });

  it('passes when a field is null, since null counts as provided', async () => {
    const dto = Object.assign(new TestDto(), {
      added: null,
    });

    expect(await validate(dto)).toHaveLength(0);
  });

  it('fails when a field is explicitly undefined', async () => {
    const dto = Object.assign(new TestDto(), {
      added: undefined,
      removed: undefined,
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(1);
  });

  it('passes when one field is null and the other is undefined', async () => {
    const dto = Object.assign(new TestDto(), {
      added: undefined,
      removed: null,
    });

    expect(await validate(dto)).toHaveLength(0);
  });

  describe('as applied to UpdateVolunteerDto', () => {
    const hasAtLeastOneValueError = async (body: object) => {
      const errors = await validate(
        Object.assign(new UpdateVolunteerDto(), body),
      );
      return errors.some(
        (error) => error.constraints?.atLeastOneValue !== undefined,
      );
    };

    it('fails when no field is provided', async () => {
      expect(await hasAtLeastOneValueError({})).toBe(true);
    });

    it('passes when a string field is provided', async () => {
      expect(await hasAtLeastOneValueError({ firstName: 'Jane' })).toBe(false);
    });

    it('passes when only a boolean field is provided, even if false', async () => {
      expect(await hasAtLeastOneValueError({ animalUpdates: false })).toBe(
        false,
      );
    });

    it('passes when an empty string is provided, leaving the field decorators to reject it', async () => {
      expect(await hasAtLeastOneValueError({ firstName: '' })).toBe(false);
    });

    it('passes when a field is null, leaving the field decorators to decide', async () => {
      expect(await hasAtLeastOneValueError({ secondaryPhone: null })).toBe(
        false,
      );
    });

    it('fails when only an empty array field is provided', async () => {
      expect(await hasAtLeastOneValueError({ fosterType: [] })).toBe(true);
    });

    it('ignores fields that are not in the list', async () => {
      expect(await hasAtLeastOneValueError({ unrelated: 'x' })).toBe(true);
    });
  });
});
