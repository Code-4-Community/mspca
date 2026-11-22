import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import {
  Box,
  Button,
  Field,
  Flex,
  Heading,
  Input,
  InputGroup,
  Stack,
  Text,
} from '@chakra-ui/react';
import { Mail } from 'lucide-react';
import { useAuthenticator } from '@aws-amplify/ui-react';
import { signIn, signOut } from 'aws-amplify/auth';

import { useCurrentUser } from '../auth/userContext';
import { getSignInErrorMessage } from '../auth/signInErrors';

/**
 * Email and password sign-in, built from the Lo-Fi. Remember me, forgot
 * password, and create account are shown but not implemented yet.
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

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    // Stops the browser from reloading the page, its default for forms.
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      // TODO: handle signIn's nextStep (e.g. email verification) in a future ticket.
      await signIn({ username: email.trim(), password });
    } catch (err) {
      setError(getSignInErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (err) {
      // TODO: replace with an error toast once we have one.
      console.error('Failed to sign out', err);
    }
  };

  return (
    <Flex
      minH="100vh"
      bg={{ base: 'gray.200', lg: 'gray.0' }}
      p={{ base: '8', lg: '16' }}
      gap="87px"
      justify={{ base: 'center', lg: 'flex-start' }}
      align={{ base: 'center', lg: 'stretch' }}
    >
      <Box
        alignSelf="center"
        w={{ base: 'full', lg: '517px' }}
        flexShrink={0}
        minH={{ base: '452px', lg: '589px' }}
        bg="gray.50"
        borderRadius="3xl"
        boxShadow="card"
        px={{ base: '9', lg: '14' }}
        py={{ base: '12', lg: '20' }}
      >
        <Stack gap="9">
          <Stack gap="2">
            <Heading as="h1" textStyle="h4" fontWeight="bold">
              Sign in
            </Heading>
            <Text textStyle="body-sm" color="fg.muted">
              Enter your email and password to bring home an animal in need
            </Text>
          </Stack>

          {accountMissing ? (
            <Stack gap="4">
              <Text role="alert" color="fg.error">
                An error signing you in has occurred, please contact an MSPCA
                staff member.
              </Text>
              <Button variant="outline" onClick={handleSignOut}>
                Sign out
              </Button>
            </Stack>
          ) : (
            <form onSubmit={handleSubmit}>
              <Stack gap="4">
                <Field.Root invalid={error !== null}>
                  <InputGroup
                    startElement={
                      <Mail size={16} strokeWidth={1.5} aria-hidden />
                    }
                  >
                    <Input
                      size="sm"
                      type="email"
                      autoComplete="email"
                      placeholder="Email"
                      aria-label="Email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                    />
                  </InputGroup>
                </Field.Root>

                <Field.Root invalid={error !== null}>
                  {/* The Lo-Fi uses the envelope icon for the password too. */}
                  <InputGroup
                    startElement={
                      <Mail size={16} strokeWidth={1.5} aria-hidden />
                    }
                  >
                    <Input
                      size="sm"
                      type="password"
                      autoComplete="current-password"
                      placeholder="Password"
                      aria-label="Password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                    />
                  </InputGroup>
                  <Field.ErrorText>{error}</Field.ErrorText>
                </Field.Root>
              </Stack>

              {/* TODO: implement remember me and forgot password. */}
              <Flex justify="space-between" mt="3">
                <Text textStyle="xs" fontWeight="medium">
                  Remember me
                </Text>
                <Text textStyle="xs" fontWeight="medium">
                  Forgot password
                </Text>
              </Flex>

              <Stack gap="4" mt="9">
                <Button type="submit" loading={submitting || checkingAccount}>
                  Log in
                </Button>
                {/* TODO: link to the create account flow. */}
                <Button type="button" variant="outline">
                  Create Account
                </Button>
              </Stack>
            </form>
          )}
        </Stack>
      </Box>

      {/* Placeholder from the Lo-Fi; desktop only. */}
      <Box
        display={{ base: 'none', lg: 'block' }}
        flex="1"
        bg="gray.200"
        borderRadius="3xl"
      />
    </Flex>
  );
};

export default SignIn;
