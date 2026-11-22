import { Center, Spinner } from '@chakra-ui/react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { ROUTES } from '../routes';
import { useCurrentUser } from './userContext';

/**
 * Shows the routes nested under it only to a signed-in user. Anyone else is
 * sent to the sign-in page, which returns them here after they sign in.
 */
const RequireAuth: React.FC = () => {
  const { currentUser, loading } = useCurrentUser();
  const location = useLocation();

  if (loading) {
    return (
      <Center minH="100vh">
        <Spinner size="xl" />
      </Center>
    );
  }

  if (!currentUser) {
    return (
      <Navigate
        to={ROUTES.SIGN_IN}
        replace
        state={{ from: location.pathname + location.search }}
      />
    );
  }

  return <Outlet />;
};

export default RequireAuth;
