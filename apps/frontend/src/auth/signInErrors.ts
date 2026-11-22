/** The names of errors from Amplify's signIn that get their own message. */
enum SignInErrorName {
  NOT_AUTHORIZED = 'NotAuthorizedException',
  USER_NOT_FOUND = 'UserNotFoundException',
  USER_NOT_CONFIRMED = 'UserNotConfirmedException',
  EMPTY_USERNAME = 'EmptySignInUsername',
  EMPTY_PASSWORD = 'EmptySignInPassword',
  LIMIT_EXCEEDED = 'LimitExceededException',
  TOO_MANY_REQUESTS = 'TooManyRequestsException',
}

// A wrong password and an unknown email get the same message, so the sign-in
// form doesn't reveal which emails have accounts.
const SIGN_IN_ERROR_MESSAGES: Record<SignInErrorName, string> = {
  [SignInErrorName.NOT_AUTHORIZED]: 'Incorrect email or password',
  [SignInErrorName.USER_NOT_FOUND]: 'Incorrect email or password',
  [SignInErrorName.USER_NOT_CONFIRMED]:
    'Please verify your email before signing in',
  [SignInErrorName.EMPTY_USERNAME]: 'Please enter your email',
  [SignInErrorName.EMPTY_PASSWORD]: 'Please enter your password',
  [SignInErrorName.LIMIT_EXCEEDED]:
    'Too many attempts. Please wait a moment and try again',
  [SignInErrorName.TOO_MANY_REQUESTS]:
    'Too many attempts. Please wait a moment and try again',
};

const DEFAULT_SIGN_IN_ERROR_MESSAGE = 'Something went wrong. Please try again';

const isSignInErrorName = (name: string): name is SignInErrorName =>
  (Object.values(SignInErrorName) as string[]).includes(name);

/**
 * Turns an error thrown by Amplify's signIn into a message for the user.
 *
 * @param error - The error thrown by signIn.
 * @returns The message to show on the sign-in form.
 */
export const getSignInErrorMessage = (error: unknown): string => {
  const name = error instanceof Error ? error.name : '';
  return isSignInErrorName(name)
    ? SIGN_IN_ERROR_MESSAGES[name]
    : DEFAULT_SIGN_IN_ERROR_MESSAGE;
};
