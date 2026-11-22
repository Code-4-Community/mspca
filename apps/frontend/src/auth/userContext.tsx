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

/** Where the GET /api/auth/me request for the signed-in user is at. */
type FetchState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'done'; user: AuthenticatedUser | null };

const UserContext = createContext<UserContextValue>({
  currentUser: null,
  loading: false,
});

/**
 * Loads the signed-in user from GET /api/auth/me whenever someone signs in,
 * and shares them through UserContext.
 *
 * Must be rendered inside Amplify's Authenticator.Provider.
 */
const SignedInUserProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { authStatus } = useAuthenticator((context) => [context.authStatus]);
  // Starts as loading, since the request begins as soon as someone signs in.
  const [fetchState, setFetchState] = useState<FetchState>({
    status: 'loading',
  });

  // This component subscribes to authStatus through useAuthenticator, so
  // React runs this effect again whenever authStatus changes, i.e. whenever
  // Amplify signs a user in or out.
  useEffect(() => {
    if (authStatus !== 'authenticated') return;

    // Ignores a response that arrives after the user has signed out.
    let cancelled = false;

    const loadCurrentUser = async () => {
      try {
        const user = await apiClient.getMe();
        if (!cancelled) setFetchState({ status: 'done', user });
      } catch (error) {
        if (!cancelled) {
          // TODO: replace with an error toast once we have one.
          console.error('Failed to load the signed-in user', error);
          setFetchState({ status: 'done', user: null });
        }
      }
    };

    loadCurrentUser();

    return () => {
      cancelled = true;
      // Forget this user, so the next sign-in starts loading from scratch.
      setFetchState({ status: 'loading' });
    };
  }, [authStatus]);

  // authStatus is Amplify's client-side sign-in state, based on the JWT
  // stored in the browser. A /me result only counts while it says someone is
  // signed in; otherwise there's nothing to fetch, so the state is idle.
  const state: FetchState =
    authStatus === 'authenticated' ? fetchState : { status: 'idle' };

  const currentUser = state.status === 'done' ? state.user : null;
  const loading = authStatus === 'configuring' || state.status === 'loading';

  // This is where the value is written to UserContext. React stores it with
  // this Provider and gives it to every component below that reads
  // UserContext (through useCurrentUser), re-rendering them when it changes.
  return (
    <UserContext.Provider value={{ currentUser, loading }}>
      {children}
    </UserContext.Provider>
  );
};

/**
 * Shares the signed-in user with every component inside it. Without the
 * VITE_ Cognito variables no one can sign in, so it shares no user.
 *
 * Must be rendered inside Amplify's Authenticator.Provider.
 */
export const UserProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  if (!isAuthEnabled()) {
    return (
      <UserContext.Provider value={{ currentUser: null, loading: false }}>
        {children}
      </UserContext.Provider>
    );
  }

  return <SignedInUserProvider>{children}</SignedInUserProvider>;
};

/**
 * The signed-in user and whether they're still loading. This is where
 * UserContext is read: React finds the nearest UserContext.Provider above the
 * calling component and returns the value it was given.
 */
export const useCurrentUser = (): UserContextValue => useContext(UserContext);
