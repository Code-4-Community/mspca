import { validate } from 'class-validator';
import { AtLeastOneFosterTypePreference } from './at-least-one-foster-type-preference.validator';

class TestDto {
  added?: string[];
  removed?: string[];

  @AtLeastOneFosterTypePreference()
  private readonly atLeastOnePreference?: boolean;
}

describe('AtLeastOneFosterTypePreference', () => {
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
      atLeastOneFosterTypePreference:
        'At least one of added or removed must be provided',
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
});
