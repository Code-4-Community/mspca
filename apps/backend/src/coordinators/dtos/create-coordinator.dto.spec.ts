import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateCoordinatorDto } from './create-coordinator.dto';
import { Homebase } from '../../types';

describe('CreateCoordinatorDto', () => {
  const validCoordinator = {
    firstName: 'Jane',
    lastName: 'Doe',
    phone: '+16175551234',
    email: 'jane.doe@mspca.org',
    password: 'StrongPass123!',
    homebase: Homebase.BOSTON,
  };

  it('accepts a valid MSPCA email', async () => {
    const dto = plainToInstance(CreateCoordinatorDto, validCoordinator);

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('rejects a non-MSPCA email', async () => {
    const dto = plainToInstance(CreateCoordinatorDto, {
      ...validCoordinator,
      email: 'jane.doe@gmail.com',
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'email')).toBe(true);
  });

  it('trims and lowercases the email before validation', async () => {
    const dto = plainToInstance(CreateCoordinatorDto, {
      ...validCoordinator,
      email: '  JANE.DOE@MSPCA.ORG  ',
    });

    const errors = await validate(dto);

    expect(dto.email).toBe('jane.doe@mspca.org');
    expect(errors).toHaveLength(0);
  });

  it('rejects whitespace-only first and last names', async () => {
    const dto = plainToInstance(CreateCoordinatorDto, {
      ...validCoordinator,
      firstName: '   ',
      lastName: '   ',
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'firstName')).toBe(true);
    expect(errors.some((error) => error.property === 'lastName')).toBe(true);
  });

  it('rejects a missing password', async () => {
    const dto = plainToInstance(CreateCoordinatorDto, {
      ...validCoordinator,
      password: undefined,
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'password')).toBe(true);
  });

  it('rejects a weak password', async () => {
    const dto = plainToInstance(CreateCoordinatorDto, {
      ...validCoordinator,
      password: 'password123',
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'password')).toBe(true);
  });

  it('accepts a strong password', async () => {
    const dto = plainToInstance(CreateCoordinatorDto, {
      ...validCoordinator,
      password: 'StrongPass123!',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });
});
