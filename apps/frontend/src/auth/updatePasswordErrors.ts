/** The names of errors from Amplify's updatePassword that get their own message. */
enum UpdatePasswordErrorName {
  NOT_AUTHORIZED = 'NotAuthorizedException',
  INVALID_PASSWORD = 'InvalidPasswordException',
  INVALID_PARAMETER = 'InvalidParameterException',
  PASSWORD_HISTORY = 'PasswordHistoryPolicyViolationException',
  EMPTY_PASSWORD = 'EmptyUpdatePassword',
  LIMIT_EXCEEDED = 'LimitExceededException',
  TOO_MANY_REQUESTS = 'TooManyRequestsException',
}

// The new password doesn't meet the user pool's rules. Cognito's own message
// names the rule, e.g. "Password must have uppercase characters".
const POLICY_MESSAGE = 'Your new password does not meet the requirements';

const UPDATE_PASSWORD_ERROR_MESSAGES: Record<UpdatePasswordErrorName, string> =
  {
    [UpdatePasswordErrorName.NOT_AUTHORIZED]:
      'Your current password is incorrect',
    [UpdatePasswordErrorName.INVALID_PASSWORD]: POLICY_MESSAGE,
    [UpdatePasswordErrorName.INVALID_PARAMETER]: POLICY_MESSAGE,
    [UpdatePasswordErrorName.PASSWORD_HISTORY]:
      'Please choose a password you have not used before',
    [UpdatePasswordErrorName.EMPTY_PASSWORD]:
      'Please enter your current and new password',
    [UpdatePasswordErrorName.LIMIT_EXCEEDED]:
      'Too many attempts. Please wait a moment and try again',
    [UpdatePasswordErrorName.TOO_MANY_REQUESTS]:
      'Too many attempts. Please wait a moment and try again',
  };

const DEFAULT_UPDATE_PASSWORD_ERROR_MESSAGE =
  'Could not update your password. Please try again';

const isUpdatePasswordErrorName = (
  name: string,
): name is UpdatePasswordErrorName =>
  (Object.values(UpdatePasswordErrorName) as string[]).includes(name);

/**
 * Turns an error thrown by Amplify's updatePassword into a message for the
 * user. When the new password breaks the password policy, Cognito's reason
 * (after its "Password does not conform to policy:" prefix) is added.
 *
 * @param error - The error thrown by updatePassword.
 * @returns The message to show in the Update Password modal.
 */
export const getUpdatePasswordErrorMessage = (error: unknown): string => {
  const name = error instanceof Error ? error.name : '';
  if (!isUpdatePasswordErrorName(name)) {
    return DEFAULT_UPDATE_PASSWORD_ERROR_MESSAGE;
  }
  if (name === UpdatePasswordErrorName.INVALID_PASSWORD) {
    const reason = (error as Error).message.split(':').slice(1).join(':');
    if (reason.trim()) return `${POLICY_MESSAGE}: ${reason.trim()}`;
  }
  return UPDATE_PASSWORD_ERROR_MESSAGES[name];
};
