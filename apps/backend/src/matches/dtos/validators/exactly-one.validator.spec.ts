import { validate } from 'class-validator';
import { ExactlyOne } from './exactly-one.validator';

@ExactlyOne<TestDto>(['a', 'b'])
class TestDto {
  a?: number;
  b?: number;
}

describe('ExactlyOne', () => {
  it('passes when only the first field is provided', async () => {
    const dto = Object.assign(new TestDto(), { a: 1 });

    expect(await validate(dto)).toHaveLength(0);
  });

  it('passes when only the second field is provided', async () => {
    const dto = Object.assign(new TestDto(), { b: 2 });

    expect(await validate(dto)).toHaveLength(0);
  });

  it('fails when both fields are provided', async () => {
    const dto = Object.assign(new TestDto(), { a: 1, b: 2 });
    const errors = await validate(dto);

    expect(errors).toHaveLength(1);
    expect(errors[0].constraints).toEqual({
      exactlyOne: 'Exactly one of a, b must be provided',
    });
  });

  it('fails when neither field is provided', async () => {
    const errors = await validate(new TestDto());

    expect(errors).toHaveLength(1);
    expect(errors[0].constraints).toEqual({
      exactlyOne: 'Exactly one of a, b must be provided',
    });
  });

  it('fails when both fields are explicitly undefined', async () => {
    const dto = Object.assign(new TestDto(), { a: undefined, b: undefined });
    const errors = await validate(dto);

    expect(errors).toHaveLength(1);
  });
});
