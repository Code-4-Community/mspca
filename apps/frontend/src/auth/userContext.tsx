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

/** The finished /api/auth/me request: the user, or null if it failed. */
type FetchResult = {
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
  const { authStatus } = useAuthenticator((context) => [context.authStatus]);
  const [fetched, setFetched] = useState<FetchResult | null>(null);

  useEffect(() => {
    if (authStatus !== 'authenticated') return;

    // Ignores a response that arrives after the user has signed out.
    let cancelled = false;

    apiClient
      .getMe()
      .then((me) => {
        if (!cancelled) setFetched({ currentUser: me });
      })
      .catch((error) => {
        if (!cancelled) {
          console.error('Failed to load the signed-in user', error);
          setFetched({ currentUser: null });
        }
      });

    return () => {
      cancelled = true;
      // Forget this user, so the next sign-in loads from scratch.
      setFetched(null);
    };
  }, [authStatus]);

  // A result only counts while someone is signed in.
  const result = authStatus === 'authenticated' ? fetched : null;
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
