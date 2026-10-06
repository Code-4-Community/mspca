import { BadRequestException } from '@nestjs/common';
import { FosterVolunteer } from '../volunteers/volunteers.entity';
import { VolunteerStatus } from '../volunteers/volunteers.types';

export function validateId(id: number, entityName: string): void {
  if (!id || id < 1) {
    throw new BadRequestException(`Invalid ${entityName} ID`);
  }
}

/**
 * Ensures a Volunteer's account is active.
 *
 * @param volunteer - The Volunteer to check.
 * @throws {BadRequestException} If the Volunteer's status is not Active.
 */
export function checkVolunteerActive(volunteer: FosterVolunteer): void {
  if (volunteer.status !== VolunteerStatus.ACTIVE) {
    throw new BadRequestException(
      `Volunteer with ID ${volunteer.volunteerId} is not active`,
    );
  }
}
