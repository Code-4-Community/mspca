import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import {
  Box,
  Button,
  Field,
  Flex,
  Heading,
  Input,
  Stack,
  Text,
} from '@chakra-ui/react';
import { useAuthenticator } from '@aws-amplify/ui-react';
import { signIn, signOut } from 'aws-amplify/auth';

import { useCurrentUser } from '../auth/userContext';
import { getSignInErrorMessage } from '../auth/signInErrors';

/**
 * Email and password sign-in, built from the Lo-Fi. Forgot password, create
 * account, and remember me are not implemented yet.
 */
const SignIn: React.FC = () => {
  const location = useLocation();
  const { authStatus } = useAuthenticator((context) => [context.authStatus]);
  const { currentUser, loading } = useCurrentUser();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Once the user is loaded, go back to the page they were trying to reach.
  if (currentUser) {
    const from = (location.state as { from?: string } | null)?.from ?? '/';
    return <Navigate to={from} replace />;
  }

  // Cognito accepted the sign-in, but /api/auth/me couldn't load the user
  // (e.g. they have no role, or no matching record).
  const accountMissing =
    authStatus === 'authenticated' && !loading && currentUser === null;
  const checkingAccount = authStatus === 'authenticated' && loading;

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    // Stops the browser from reloading the page, its default for forms.
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    signIn({ username: email.trim(), password })
      .then(({ nextStep }) => {
        // Other steps (like setting a new password) aren't supported yet.
        if (nextStep.signInStep !== 'DONE') {
          setError(
            'This account needs more setup before it can sign in. Please contact an MSPCA staff member.',
          );
        }
      })
      .catch((err: unknown) => {
        setError(getSignInErrorMessage(err));
      })
      .finally(() => {
        setSubmitting(false);
      });
  };

  const handleSignOut = () => {
    signOut().catch((err: unknown) => {
      console.error('Failed to sign out', err);
    });
  };

  return (
    <Flex minH="100vh" align="center" justify="center" bg="gray.50" px="4">
      <Box
        w="full"
        maxW="420px"
        bg="white"
        p="8"
        borderRadius="lg"
        boxShadow="card"
      >
        <Stack gap="6">
          <Stack gap="2">
            <Heading as="h1" size="2xl">
              Sign in
            </Heading>
            <Text color="gray.600">
              Enter your email and password to bring home an animal in need
            </Text>
          </Stack>

          {accountMissing ? (
            <Stack gap="4">
              <Text role="alert" color="red.600">
                You signed in, but we couldn&apos;t load your account. Please
                contact an MSPCA staff member.
              </Text>
              <Button variant="outline" onClick={handleSignOut}>
                Sign out
              </Button>
            </Stack>
          ) : (
            <form onSubmit={handleSubmit}>
              <Stack gap="4">
                <Field.Root>
                  <Field.Label>Email</Field.Label>
                  <Input
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </Field.Root>

                <Field.Root>
                  <Field.Label>Password</Field.Label>
                  <Input
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                </Field.Root>

                {error && (
                  <Text role="alert" color="red.600">
                    {error}
                  </Text>
                )}

                <Button type="submit" loading={submitting || checkingAccount}>
                  Log in
                </Button>
              </Stack>
            </form>
          )}
        </Stack>
      </Box>
    </Flex>
  );
};

export default SignIn;
