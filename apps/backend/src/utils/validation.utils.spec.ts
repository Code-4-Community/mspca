import { BadRequestException } from '@nestjs/common';
import { checkVolunteerActive, validateId } from './validation.utils';
import { FosterVolunteer } from '../volunteers/volunteers.entity';
import { VolunteerStatus } from '../volunteers/volunteers.types';

describe('validateId', () => {
  it('should not throw an error for a valid ID', () => {
    expect(() => validateId(5, 'User')).not.toThrow();
  });

  it('should throw BadRequestException for ID < 1', () => {
    expect(() => validateId(0, 'User')).toThrow(
      new BadRequestException('Invalid User ID'),
    );
  });
});

describe('checkVolunteerActive', () => {
  const makeVolunteer = (status: VolunteerStatus) =>
    ({ volunteerId: 1, status } as FosterVolunteer);

  it('should not throw an error for an active volunteer', () => {
    expect(() =>
      checkVolunteerActive(makeVolunteer(VolunteerStatus.ACTIVE)),
    ).not.toThrow();
  });

  it.each([VolunteerStatus.PENDING, VolunteerStatus.INACTIVE])(
    'should throw BadRequestException for a %s volunteer',
    (status) => {
      expect(() => checkVolunteerActive(makeVolunteer(status))).toThrow(
        new BadRequestException('Volunteer with ID 1 is not active'),
      );
    },
  );
});
