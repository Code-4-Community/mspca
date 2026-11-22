import { UserRole, type AuthenticatedUser } from '../types';
import { getUserId } from './user';

describe('getUserId', () => {
  it('returns the volunteer ID for a volunteer', () => {
    const currentUser = {
      role: UserRole.FOSTER_VOLUNTEER,
      user: { volunteerId: 4 },
    } as AuthenticatedUser;

    expect(getUserId(currentUser)).toBe(4);
  });

  it('returns the coordinator ID for a coordinator', () => {
    const currentUser = {
      role: UserRole.FOSTER_COORDINATOR,
      user: { coordinatorId: 7 },
    } as AuthenticatedUser;

    expect(getUserId(currentUser)).toBe(7);
  });

  it('returns the owner ID for an owner', () => {
    const currentUser = {
      role: UserRole.OWNER,
      user: { ownerId: 9 },
    } as AuthenticatedUser;

    expect(getUserId(currentUser)).toBe(9);
  });
});
