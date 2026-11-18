/**
 * Turns an error thrown by Amplify's signIn into a message for the user.
 *
 * A wrong password and an unknown email get the same message, so the sign-in
 * form doesn't reveal which emails have accounts.
 *
 * @param error - The error thrown by signIn.
 * @returns The message to show on the sign-in form.
 */
export const getSignInErrorMessage = (error: unknown): string => {
  const name = error instanceof Error ? error.name : '';

  switch (name) {
    case 'NotAuthorizedException':
    case 'UserNotFoundException':
      return 'Incorrect email or password';
    case 'UserNotConfirmedException':
      return 'Please verify your email before signing in';
    case 'EmptySignInUsername':
      return 'Please enter your email';
    case 'EmptySignInPassword':
      return 'Please enter your password';
    case 'LimitExceededException':
    case 'TooManyRequestsException':
      return 'Too many attempts. Please wait a moment and try again';
    default:
      return 'Something went wrong. Please try again';
  }
};
