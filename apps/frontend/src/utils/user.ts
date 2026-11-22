import { UserRole, type AuthenticatedUser } from '../types';

/**
 * The signed-in user's ID from their role's table: their volunteerId,
 * coordinatorId, or ownerId.
 *
 * @param currentUser - The signed-in user, from useCurrentUser.
 * @returns The user's ID.
 */
export const getUserId = (currentUser: AuthenticatedUser): number => {
  if (currentUser.role === UserRole.FOSTER_VOLUNTEER) {
    return currentUser.user.volunteerId;
  }
  if (currentUser.role === UserRole.FOSTER_COORDINATOR) {
    return currentUser.user.coordinatorId;
  }
  return currentUser.user.ownerId;
};
