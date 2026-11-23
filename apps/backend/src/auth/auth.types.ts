import { CognitoRole } from '../aws/cognito/cognito.types';
import { FosterCoordinator } from '../coordinators/coordinators.entity';
import { Owner } from '../owners/owners.entity';
import { FosterStaff } from '../staff/staff.entity';
import { VolunteerWithoutPrivateFields } from '../volunteers/dtos/volunteer-without-private-fields.dto';

/**
 * The signed-in user returned by GET /auth/me: their role, plus their
 * record from the table that matches that role.
 */
export type AuthenticatedUser =
  | { role: CognitoRole.FosterVolunteer; user: VolunteerWithoutPrivateFields }
  | { role: CognitoRole.Staff; user: FosterStaff }
  | { role: CognitoRole.FosterCoordinator; user: FosterCoordinator }
  | { role: CognitoRole.Owner; user: Owner };
