import {
  UserRole,
  type AuthenticatedUser,
  type Coordinator,
  type Owner,
  type Volunteer,
} from '../types';
import { getUserId } from './user';

describe('getUserId', () => {
  it('returns the volunteer ID for a volunteer', () => {
    const currentUser: AuthenticatedUser = {
      role: UserRole.FOSTER_VOLUNTEER,
      user: { volunteerId: 4 } as Volunteer,
    };

    expect(getUserId(currentUser)).toBe(4);
  });

  it('returns the coordinator ID for a coordinator', () => {
    const currentUser: AuthenticatedUser = {
      role: UserRole.FOSTER_COORDINATOR,
      user: { coordinatorId: 7 } as Coordinator,
    };

    expect(getUserId(currentUser)).toBe(7);
  });

  it('returns the owner ID for an owner', () => {
    const currentUser: AuthenticatedUser = {
      role: UserRole.OWNER,
      user: { ownerId: 9 } as Owner,
    };

    expect(getUserId(currentUser)).toBe(9);
  });
});
