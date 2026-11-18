import { createContext, useContext, useEffect, useState } from 'react';
import { useAuthenticator } from '@aws-amplify/ui-react';

import apiClient from '@api/apiClient';
import type { AuthenticatedUser } from '../types';
import { isAuthEnabled } from './auth.config';

type UserContextValue = {
  /** The signed-in user and their role, or null if no one is signed in. */
  currentUser: AuthenticatedUser | null;
  /** True while we're still finding out who is signed in. */
  loading: boolean;
};

/** A /api/auth/me result, tagged with the Cognito user it was fetched for. */
type FetchedUser = {
  userId: string;
  currentUser: AuthenticatedUser | null;
};

const UserContext = createContext<UserContextValue>({
  currentUser: null,
  loading: false,
});

/**
 * Fetches the signed-in user from GET /api/auth/me whenever someone signs
 * in, and shares them with every component inside it.
 *
 * Must be rendered inside Amplify's Authenticator.Provider.
 */
export const UserProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { authStatus, user } = useAuthenticator((context) => [
    context.authStatus,
    context.user,
  ]);
  const [fetched, setFetched] = useState<FetchedUser | null>(null);

  // The signed-in user's Cognito ID (their sub), or undefined if signed out.
  const userId = authStatus === 'authenticated' ? user?.userId : undefined;

  useEffect(() => {
    if (!userId) return;

    // Ignores a response that arrives after the user has signed out.
    let cancelled = false;

    apiClient
      .getMe()
      .then((me) => {
        if (!cancelled) setFetched({ userId, currentUser: me });
      })
      .catch((error) => {
        if (!cancelled) {
          console.error('Failed to load the signed-in user', error);
          setFetched({ userId, currentUser: null });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Only trust a result fetched for the user who is signed in right now.
  const result = fetched !== null && fetched.userId === userId ? fetched : null;
  const currentUser = result?.currentUser ?? null;

  // Without the VITE_ Cognito variables no one can sign in, so never load.
  const loading =
    isAuthEnabled() &&
    (authStatus === 'configuring' ||
      (authStatus === 'authenticated' && result === null));

  return (
    <UserContext.Provider value={{ currentUser, loading }}>
      {children}
    </UserContext.Provider>
  );
};

/** The signed-in user and whether they're still loading. */
export const useCurrentUser = (): UserContextValue => useContext(UserContext);
