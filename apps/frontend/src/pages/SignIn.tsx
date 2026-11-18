import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import {
  Box,
  Button,
  Field,
  Flex,
  Heading,
  Icon,
  Input,
  Stack,
  Text,
} from '@chakra-ui/react';
import { Mail } from 'lucide-react';
import { useAuthenticator } from '@aws-amplify/ui-react';
import { signIn, signOut } from 'aws-amplify/auth';

import { useCurrentUser } from '../auth/userContext';
import { getSignInErrorMessage } from '../auth/signInErrors';

/**
 * A small input with an envelope icon inside its left edge, as in the Lo-Fi.
 * The Lo-Fi uses the envelope for the password field too.
 */
const IconInput: React.FC<React.ComponentProps<typeof Input>> = (props) => (
  <Box position="relative" w="full">
    <Icon
      asChild
      position="absolute"
      left="3"
      top="50%"
      transform="translateY(-50%)"
      boxSize="4"
      color="fg.muted"
      pointerEvents="none"
      zIndex="1"
    >
      <Mail strokeWidth={1.5} aria-hidden />
    </Icon>
    <Input size="sm" ps="9" {...props} />
  </Box>
);

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
    <Flex
      minH="100vh"
      bg={{ base: 'gray.200', lg: 'white' }}
      p={{ base: '8', lg: '16' }}
      gap="87px"
      justify={{ base: 'center', lg: 'flex-start' }}
      align={{ base: 'center', lg: 'stretch' }}
    >
      {/* Sizes and spacing are from the Lo-Fi's Desktop - 1 and iPhone 17 frames. */}
      <Box
        alignSelf="center"
        w={{ base: 'full', lg: '517px' }}
        flexShrink={0}
        minH={{ base: '452px', lg: '589px' }}
        bg="gray.50"
        borderRadius="3xl"
        boxShadow="md"
        px={{ base: '9', lg: '14' }}
        py={{ base: '12', lg: '20' }}
      >
        <Stack gap="9">
          <Stack gap="2">
            <Heading as="h1" size="3xl" fontWeight="bold">
              Sign in
            </Heading>
            <Text textStyle="sm" color="gray.600">
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
                <Field.Root invalid={error !== null}>
                  <IconInput
                    type="email"
                    autoComplete="email"
                    placeholder="Email"
                    aria-label="Email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </Field.Root>

                <Field.Root invalid={error !== null}>
                  <IconInput
                    type="password"
                    autoComplete="current-password"
                    placeholder="Password"
                    aria-label="Password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
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
