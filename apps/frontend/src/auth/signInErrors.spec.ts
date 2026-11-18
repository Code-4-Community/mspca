import { getSignInErrorMessage, getSignInStepMessage } from './signInErrors';

// Builds an error with the given name, like the ones Amplify's signIn throws.
const errorNamed = (name: string): Error => {
  const error = new Error('Message from Cognito');
  error.name = name;
  return error;
};

describe('getSignInErrorMessage', () => {
  it('returns a generic message for a wrong password', () => {
    expect(getSignInErrorMessage(errorNamed('NotAuthorizedException'))).toBe(
      'Incorrect email or password',
    );
  });

  it('returns the same message for an unknown email', () => {
    expect(getSignInErrorMessage(errorNamed('UserNotFoundException'))).toBe(
      'Incorrect email or password',
    );
  });

  it('asks unconfirmed users to verify their email', () => {
    expect(getSignInErrorMessage(errorNamed('UserNotConfirmedException'))).toBe(
      'Please verify your email before signing in',
    );
  });

  it('asks for an email when it is empty', () => {
    expect(getSignInErrorMessage(errorNamed('EmptySignInUsername'))).toBe(
      'Please enter your email',
    );
  });

  it('asks for a password when it is empty', () => {
    expect(getSignInErrorMessage(errorNamed('EmptySignInPassword'))).toBe(
      'Please enter your password',
    );
  });

  it('tells the user to wait after too many attempts', () => {
    expect(getSignInErrorMessage(errorNamed('LimitExceededException'))).toBe(
      'Too many attempts. Please wait a moment and try again',
    );
  });

  it('falls back to a generic message for unknown errors', () => {
    expect(getSignInErrorMessage(errorNamed('SomethingElse'))).toBe(
      'Something went wrong. Please try again',
    );
  });

  it('falls back to a generic message for values that are not errors', () => {
    expect(getSignInErrorMessage('oops')).toBe(
      'Something went wrong. Please try again',
    );
  });
});

describe('getSignInStepMessage', () => {
  it('asks unconfirmed users to verify their email', () => {
    expect(getSignInStepMessage('CONFIRM_SIGN_UP')).toBe(
      'Please verify your email before signing in',
    );
  });

  it('asks users who must set a new password to contact staff', () => {
    expect(
      getSignInStepMessage('CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED'),
    ).toBe(
      'This account needs more setup before it can sign in. Please contact an MSPCA staff member.',
    );
  });

  it('falls back to the setup message for steps it does not know', () => {
    expect(getSignInStepMessage('SOMETHING_NEW')).toBe(
      'This account needs more setup before it can sign in. Please contact an MSPCA staff member.',
    );
  });
});
