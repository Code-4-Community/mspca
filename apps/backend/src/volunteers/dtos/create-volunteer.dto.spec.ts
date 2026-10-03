import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateVolunteerDto } from './create-volunteer.dto';
import { Homebase } from '../../types';
import { FosterType } from '../volunteers.types';

const validPayload = {
  firstName: 'Jane',
  lastName: 'Doe',
  phone: '617-555-0100',
  email: 'jane@example.com',
  address: '350 S Huntington Ave',
  city: 'Boston',
  zipcode: '02130',
  homebase: Homebase.BOSTON,
  residentAnimals: 'One cat',
  fosterType: FosterType.CAT,
};

const invalidFields = async (payload: object): Promise<string[]> => {
  const errors = await validate(plainToInstance(CreateVolunteerDto, payload));
  return errors.map((error) => error.property);
};

describe('CreateVolunteerDto', () => {
  it('accepts a payload with only the required fields', async () => {
    await expect(invalidFields(validPayload)).resolves.toEqual([]);
  });

  it('accepts the optional notes, secondaryPhone, and completedCanineTraining', async () => {
    await expect(
      invalidFields({
        ...validPayload,
        notes: 'Prefers kittens',
        secondaryPhone: '617-555-0199',
        completedCanineTraining: false,
      }),
    ).resolves.toEqual([]);
  });

  it.each(Object.keys(validPayload))(
    'rejects a payload missing %s',
    async (field) => {
      const payload: Record<string, unknown> = { ...validPayload };
      delete payload[field];

      await expect(invalidFields(payload)).resolves.toEqual([field]);
    },
  );

  it('rejects an empty required string', async () => {
    await expect(
      invalidFields({ ...validPayload, firstName: '' }),
    ).resolves.toEqual(['firstName']);
  });

  it.each([
    ['phone', 20],
    ['secondaryPhone', 20],
    ['zipcode', 10],
    ['firstName', 255],
  ])(
    'rejects a %s longer than its %i-character column',
    async (field, maxLength) => {
      await expect(
        invalidFields({ ...validPayload, [field]: '1'.repeat(maxLength + 1) }),
      ).resolves.toEqual([field]);
    },
  );

  it('rejects an invalid email', async () => {
    await expect(
      invalidFields({ ...validPayload, email: 'not-an-email' }),
    ).resolves.toEqual(['email']);
  });

  it('rejects an unknown homebase', async () => {
    await expect(
      invalidFields({ ...validPayload, homebase: 'Mars' }),
    ).resolves.toEqual(['homebase']);
  });

  it('rejects an unknown fosterType', async () => {
    await expect(
      invalidFields({ ...validPayload, fosterType: 'Dragon' }),
    ).resolves.toEqual(['fosterType']);
  });

  it('rejects a non-boolean completedCanineTraining', async () => {
    await expect(
      invalidFields({ ...validPayload, completedCanineTraining: 'yes' }),
    ).resolves.toEqual(['completedCanineTraining']);
  });
});
