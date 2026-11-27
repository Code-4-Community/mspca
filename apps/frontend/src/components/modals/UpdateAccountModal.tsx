import { useState } from 'react';
import { Button, Dialog, Flex, Input, Portal, Text } from '@chakra-ui/react';
import { updatePassword } from 'aws-amplify/auth';

import { getUpdatePasswordErrorMessage } from '../../auth/updatePasswordErrors';

interface AccountField {
  label: string;
  type: 'password' | 'email';
  autoComplete: string;
}

interface UpdateAccountModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  fields: [AccountField, AccountField];
  // Saves the two values, in the order of `fields`. Resolves with an error
  // message to show, or undefined once the change is saved.
  onSave: (values: [string, string]) => Promise<string | undefined>;
  // Called after a successful save, once the modal has closed.
  onSaved?: () => void;
}

/**
 * Small modal with two required fields and a Save Changes button, used to
 * update a volunteer's account details (password and email). Both
 * fields must be filled in before `onSave` runs; its error, if any, is shown
 * above the button. The form clears whenever the modal closes.
 */
const UpdateAccountModal: React.FC<UpdateAccountModalProps> = ({
  open,
  onClose,
  title,
  fields,
  onSave,
  onSaved,
}) => {
  const [values, setValues] = useState<[string, string]>(['', '']);
  const [missing, setMissing] = useState<[boolean, boolean]>([false, false]);
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  const close = () => {
    setValues(['', '']);
    setMissing([false, false]);
    setError(undefined);
    onClose();
  };

  const save = async () => {
    const nowMissing: [boolean, boolean] = [!values[0], !values[1]];
    setMissing(nowMissing);
    setError(undefined);
    if (nowMissing[0] || nowMissing[1]) return;

    setSaving(true);
    const saveError = await onSave(values);
    setSaving(false);
    if (saveError) {
      setError(saveError);
      return;
    }
    close();
    onSaved?.();
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(e) => {
        if (!e.open && !saving) close();
      }}
      placement="center"
      lazyMount
      unmountOnExit
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner px="4">
          <Dialog.Content
            w="full"
            maxW="md"
            m="0"
            px="5"
            pt="22px"
            pb="5"
            bg="gray.0"
            borderRadius="xl"
            boxShadow="card"
          >
            <form
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                void save();
              }}
            >
              <Flex direction="column" gap="7">
                <Dialog.Title
                  color="black"
                  fontSize="20px"
                  fontWeight="semibold"
                  lineHeight="32px"
                >
                  {title}
                </Dialog.Title>
                <Flex direction="column" align="flex-end" gap="3.5">
                  <Flex direction="column" alignSelf="stretch" gap="4">
                    {fields.map((field, i) => (
                      <Flex key={field.label} direction="column" gap="1.5">
                        <Text
                          asChild
                          color="fg"
                          fontSize="14px"
                          fontWeight="medium"
                          lineHeight="20px"
                        >
                          <label htmlFor={`account-field-${i}`}>
                            {field.label}
                            <Text
                              as="span"
                              color="fg.error"
                              fontWeight="semibold"
                            >
                              *
                            </Text>
                          </label>
                        </Text>
                        <Input
                          id={`account-field-${i}`}
                          type={field.type}
                          autoComplete={field.autoComplete}
                          placeholder="Type here"
                          h="9"
                          px="2.5"
                          borderColor="border"
                          borderRadius="sm"
                          fontSize="14px"
                          lineHeight="20px"
                          aria-invalid={missing[i] || undefined}
                          disabled={saving}
                          value={values[i]}
                          onChange={(e) => {
                            const next = e.target.value;
                            setValues((prev) =>
                              i === 0 ? [next, prev[1]] : [prev[0], next],
                            );
                          }}
                        />
                        {missing[i] && (
                          <Text
                            color="fg.error"
                            fontSize="12px"
                            lineHeight="16px"
                          >
                            {field.label} is required.
                          </Text>
                        )}
                      </Flex>
                    ))}
                  </Flex>
                  {error && (
                    <Text
                      alignSelf="stretch"
                      color="fg.error"
                      fontSize="14px"
                      lineHeight="20px"
                      role="alert"
                    >
                      {error}
                    </Text>
                  )}
                  <Button
                    type="submit"
                    h="9"
                    minW="9"
                    px="3.5"
                    bg="blue.blue3"
                    color="fg.inverted"
                    borderRadius="xl"
                    fontSize="14px"
                    fontWeight="semibold"
                    lineHeight="20px"
                    loading={saving}
                  >
                    Save Changes
                  </Button>
                </Flex>
              </Flex>
            </form>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
};

interface AccountModalProps {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

/**
 * Changes the signed-in user's Cognito password.
 *
 * Not used yet: the Update Password button on the Settings card stays
 * disabled for now.
 */
export const UpdatePasswordModal: React.FC<AccountModalProps> = (props) => (
  <UpdateAccountModal
    {...props}
    title="Update Password"
    fields={[
      {
        label: 'Current Password',
        type: 'password',
        autoComplete: 'current-password',
      },
      { label: 'New Password', type: 'password', autoComplete: 'new-password' },
    ]}
    onSave={async ([oldPassword, newPassword]) => {
      try {
        await updatePassword({ oldPassword, newPassword });
        return undefined;
      } catch (err) {
        return getUpdatePasswordErrorMessage(err);
      }
    }}
  />
);

/**
 * Changes the volunteer's email after confirming their password.
 *
 * Not used yet: the sign-in email lives in Cognito as well as the database,
 * and the backend has no endpoint that updates both, so `onSave` is passed in
 * once one exists.
 */
export const UpdateEmailModal: React.FC<
  AccountModalProps & {
    onSave: (password: string, newEmail: string) => Promise<string | undefined>;
  }
> = ({ onSave, ...props }) => (
  <UpdateAccountModal
    {...props}
    title="Update Email Address"
    fields={[
      { label: 'Password', type: 'password', autoComplete: 'current-password' },
      { label: 'New Email Address', type: 'email', autoComplete: 'email' },
    ]}
    onSave={([password, newEmail]) => onSave(password, newEmail.trim())}
  />
);
