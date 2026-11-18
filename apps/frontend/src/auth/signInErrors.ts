const VERIFY_EMAIL_MESSAGE = 'Please verify your email before signing in';

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
  // Amplify usually reports unconfirmed users as the CONFIRM_SIGN_UP step
  // instead (see getSignInStepMessage), but handle the error too.
  [SignInErrorName.USER_NOT_CONFIRMED]: VERIFY_EMAIL_MESSAGE,
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

/** Unfinished sign-in steps from Amplify's signIn that get their own message. */
enum SignInStep {
  CONFIRM_SIGN_UP = 'CONFIRM_SIGN_UP',
}

const SIGN_IN_STEP_MESSAGES: Record<SignInStep, string> = {
  [SignInStep.CONFIRM_SIGN_UP]: VERIFY_EMAIL_MESSAGE,
};

// Other steps (like setting a new password) aren't supported yet.
const DEFAULT_SIGN_IN_STEP_MESSAGE =
  'This account needs more setup before it can sign in. Please contact an MSPCA staff member.';

const isSignInStep = (step: string): step is SignInStep =>
  (Object.values(SignInStep) as string[]).includes(step);

/**
 * Turns a sign-in that Cognito accepted but didn't finish into a message for
 * the user.
 *
 * @param step - The `nextStep.signInStep` returned by signIn, when it isn't DONE.
 * @returns The message to show on the sign-in form.
 */
export const getSignInStepMessage = (step: string): string =>
  isSignInStep(step)
    ? SIGN_IN_STEP_MESSAGES[step]
    : DEFAULT_SIGN_IN_STEP_MESSAGE;
