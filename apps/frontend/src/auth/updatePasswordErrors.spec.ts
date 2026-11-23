import { getUpdatePasswordErrorMessage } from './updatePasswordErrors';

// Builds an error with the given name, like the ones Amplify's
// updatePassword throws.
const errorNamed = (name: string, message = 'Message from Cognito'): Error => {
  const error = new Error(message);
  error.name = name;
  return error;
};

describe('getUpdatePasswordErrorMessage', () => {
  it('says the current password is wrong', () => {
    expect(
      getUpdatePasswordErrorMessage(errorNamed('NotAuthorizedException')),
    ).toBe('Your current password is incorrect');
  });

  it("adds Cognito's reason when the new password breaks the policy", () => {
    expect(
      getUpdatePasswordErrorMessage(
        errorNamed(
          'InvalidPasswordException',
          'Password does not conform to policy: Password must have uppercase characters',
        ),
      ),
    ).toBe(
      'Your new password does not meet the requirements: Password must have uppercase characters',
    );
  });

  it('falls back to the policy message when Cognito gives no reason', () => {
    expect(
      getUpdatePasswordErrorMessage(
        errorNamed('InvalidPasswordException', 'Invalid password'),
      ),
    ).toBe('Your new password does not meet the requirements');
  });

  it('asks for a password that was not used before', () => {
    expect(
      getUpdatePasswordErrorMessage(
        errorNamed('PasswordHistoryPolicyViolationException'),
      ),
    ).toBe('Please choose a password you have not used before');
  });

  it('asks for both passwords when one is empty', () => {
    expect(
      getUpdatePasswordErrorMessage(errorNamed('EmptyUpdatePassword')),
    ).toBe('Please enter your current and new password');
  });

  it('asks the user to wait after too many attempts', () => {
    expect(
      getUpdatePasswordErrorMessage(errorNamed('LimitExceededException')),
    ).toBe('Too many attempts. Please wait a moment and try again');
  });

  it('returns a generic message for unknown errors', () => {
    expect(getUpdatePasswordErrorMessage(new Error('boom'))).toBe(
      'Could not update your password. Please try again',
    );
    expect(getUpdatePasswordErrorMessage('not an error')).toBe(
      'Could not update your password. Please try again',
    );
  });
});
