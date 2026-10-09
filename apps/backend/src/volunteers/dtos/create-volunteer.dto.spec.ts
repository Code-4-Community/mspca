import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateVolunteerDto } from './create-volunteer.dto';
import { FosterType } from '../volunteers.types';
import { Homebase } from '../../types';

const validBody = {
  firstName: 'Jane',
  lastName: 'Doe',
  phone: '617-555-0100',
  email: 'jane@example.com',
  address: '350 S Huntington Ave',
  city: 'Boston',
  zipcode: '02130',
  homebase: Homebase.BOSTON,
  residentAnimals: 'One cat',
  fosterType: [FosterType.CAT],
};

async function fosterTypeErrors(fosterType: unknown) {
  const errors = await validate(
    plainToInstance(CreateVolunteerDto, { ...validBody, fosterType }),
  );
  return errors.filter((e) => e.property === 'fosterType');
}

describe('CreateVolunteerDto fosterType', () => {
  it('accepts a list with one type', async () => {
    expect(await fosterTypeErrors([FosterType.DOG])).toHaveLength(0);
  });

  it('accepts a list with several types', async () => {
    expect(
      await fosterTypeErrors([FosterType.DOG, FosterType.CAT]),
    ).toHaveLength(0);
  });

  it('rejects an empty list', async () => {
    expect(await fosterTypeErrors([])).not.toHaveLength(0);
  });

  it('rejects a single value that is not in a list', async () => {
    expect(await fosterTypeErrors(FosterType.DOG)).not.toHaveLength(0);
  });

  it('rejects a list containing an invalid type', async () => {
    expect(await fosterTypeErrors(['Dragon'])).not.toHaveLength(0);
  });

  it('rejects a missing fosterType', async () => {
    expect(await fosterTypeErrors(undefined)).not.toHaveLength(0);
  });
});
