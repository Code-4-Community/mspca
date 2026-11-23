import { useState } from 'react';
import { Box, Flex, Input, Switch, Text } from '@chakra-ui/react';
import { Save, SquarePen, SquareX } from 'lucide-react';

import apiClient from '@api/apiClient';
import type { Volunteer } from '../../types';
import type { ApiData } from '@utils/useApiData';
import { ErrorState, LoadingState } from './FetchStates';
import {
  ErrorText,
  HeaderButton,
  fieldStyles,
  getSaveErrorMessage,
} from './ProfileInformation';

// A US number has 10 digits, optionally after a leading country code of 1.
// The backend does the full check; this catches typos before saving.
const validatePhone = (phone: string): string | undefined => {
  const digits = phone.replace(/\D/g, '');
  if (!phone.trim()) return 'Phone number is required.';
  if (
    digits.length !== 10 &&
    !(digits.length === 11 && digits.startsWith('1'))
  ) {
    return 'Enter a 10-digit US phone number.';
  }
  return undefined;
};

const SectionHeader: React.FC<{ title: string }> = ({ title }) => (
  <Flex h="9" align="center" px="3" bg="gray.100">
    <Text
      color="black"
      fontSize={{ base: '12px', lg: '14px' }}
      fontWeight="semibold"
      lineHeight="20px"
    >
      {title}
    </Text>
  </Flex>
);

// One setting: a label and its current value on the left, and its control
// (a button or switch) on the right; on mobile the control goes underneath.
// Rows are separated by a thin divider.
const SettingRow: React.FC<{
  label: string;
  value?: React.ReactNode;
  control?: React.ReactNode;
  error?: string;
}> = ({ label, value, control, error }) => (
  <Flex direction="column" gap="3.5">
    <Box h="0.5" bg="gray.100" />
    <Flex
      direction={{ base: 'column', lg: 'row' }}
      justify="space-between"
      align={{ base: 'flex-start', lg: 'center' }}
      gap={{ base: '3.5', lg: '4' }}
    >
      <Flex direction="column" minW="0">
        <Text
          color="black"
          fontSize={{ base: '12px', lg: '14px' }}
          fontWeight="semibold"
          lineHeight="20px"
        >
          {label}
        </Text>
        {typeof value === 'string' ? (
          <Text
            color="black"
            fontSize="12px"
            lineHeight="20px"
            // Long emails break anywhere; sentences only between words.
            overflowWrap="anywhere"
          >
            {value}
          </Text>
        ) : (
          value
        )}
      </Flex>
      {control}
    </Flex>
    <ErrorText>{error}</ErrorText>
  </Flex>
);

interface ProfileSettingsProps {
  volunteer: ApiData<Volunteer>;
}

/**
 * The "Settings" card on the Volunteer Profile's Information & Settings tab.
 *
 * Security: the phone number is updated inline. Email and password are
 * read-only for now, since both are the volunteer's Cognito sign-in;
 * UpdateEmailModal and UpdatePasswordModal are built for when those
 * buttons are enabled.
 *
 * Notifications: the only notification preference in the schema is
 * `animalUpdates`, which saves as soon as it's toggled.
 */
const ProfileSettings: React.FC<ProfileSettingsProps> = ({ volunteer }) => {
  // The phone number being edited; null when not editing.
  const [phone, setPhone] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string>();
  const [savingPhone, setSavingPhone] = useState(false);
  const [savingUpdates, setSavingUpdates] = useState(false);
  const [updatesError, setUpdatesError] = useState<string>();

  // ProfileInformation already shows the not found / error message for the
  // same request, so this card only shows the retry.
  if (volunteer.loading) return <LoadingState />;
  if (volunteer.error || !volunteer.data) {
    return (
      <ErrorState
        message="Your settings couldn't be loaded."
        onRetry={volunteer.notFound ? undefined : volunteer.reload}
      />
    );
  }

  const data = volunteer.data;
  const editingPhone = phone !== null;

  const cancelPhone = () => {
    setPhone(null);
    setPhoneError(undefined);
  };

  const savePhone = async () => {
    if (phone === null) return;
    const error = validatePhone(phone);
    setPhoneError(error);
    if (error) return;

    const next = phone.trim();
    if (next === data.phone) {
      cancelPhone();
      return;
    }

    setSavingPhone(true);
    try {
      volunteer.setData(
        await apiClient.updateVolunteer(data.volunteerId, { phone: next }),
      );
      cancelPhone();
    } catch (err) {
      setPhoneError(getSaveErrorMessage(err));
    } finally {
      setSavingPhone(false);
    }
  };

  const toggleAnimalUpdates = async (animalUpdates: boolean) => {
    setSavingUpdates(true);
    setUpdatesError(undefined);
    try {
      volunteer.setData(
        await apiClient.updateVolunteer(data.volunteerId, { animalUpdates }),
      );
    } catch (err) {
      setUpdatesError(getSaveErrorMessage(err));
    } finally {
      setSavingUpdates(false);
    }
  };

  const pencil = <SquarePen strokeWidth={2} aria-hidden />;

  return (
    <Flex direction="column" gap={{ base: '4', lg: '6' }}>
      <Text
        color="black"
        fontSize={{ base: '20px', lg: '24px' }}
        fontWeight="semibold"
        lineHeight="36px"
      >
        Settings
      </Text>

      <Flex direction="column" gap="3.5">
        <SectionHeader title="Security" />
        <SettingRow
          label="Email Address"
          value={data.email}
          control={
            <HeaderButton
              label="Update Email Address"
              w={{ base: '48', lg: '44' }}
              icon={pencil}
              onClick={() => undefined}
              disabled
            />
          }
        />
        <SettingRow
          label="Phone Number"
          value={
            editingPhone ? (
              <Input
                {...fieldStyles}
                mt="1"
                w="48"
                h="8"
                type="tel"
                autoComplete="tel"
                aria-label="Phone Number"
                aria-invalid={phoneError ? true : undefined}
                value={phone}
                disabled={savingPhone}
                onChange={(e) => setPhone(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void savePhone();
                }}
              />
            ) : (
              data.phone
            )
          }
          control={
            editingPhone ? (
              <Flex gap="2">
                <HeaderButton
                  label="Cancel"
                  w="24"
                  icon={<SquareX strokeWidth={2} aria-hidden />}
                  onClick={cancelPhone}
                  disabled={savingPhone}
                />
                <HeaderButton
                  label="Save"
                  w="20"
                  primary
                  icon={<Save strokeWidth={1.5} aria-hidden />}
                  onClick={() => void savePhone()}
                  loading={savingPhone}
                />
              </Flex>
            ) : (
              <HeaderButton
                label="Update Phone Number"
                w={{ base: '48', lg: '44' }}
                icon={pencil}
                onClick={() => {
                  setPhone(data.phone);
                  setPhoneError(undefined);
                }}
              />
            )
          }
          error={phoneError}
        />
        <SettingRow
          label="Password"
          value="••••••••••••••••"
          control={
            <HeaderButton
              label="Update Password"
              w={{ base: '48', lg: '36' }}
              icon={pencil}
              onClick={() => undefined}
              disabled
            />
          }
        />
      </Flex>

      <Flex direction="column" gap="3.5">
        <SectionHeader title="Notifications" />
        <SettingRow
          label="Animal Updates"
          value="Receive updates about animals that need a foster home."
          control={
            <Switch.Root
              size="lg"
              checked={data.animalUpdates}
              disabled={savingUpdates}
              onCheckedChange={(e) => void toggleAnimalUpdates(e.checked)}
            >
              <Switch.HiddenInput aria-label="Animal Updates" />
              <Switch.Control _checked={{ bg: 'blue.blue3' }}>
                <Switch.Thumb />
              </Switch.Control>
            </Switch.Root>
          }
          error={updatesError}
        />
      </Flex>
    </Flex>
  );
};

export default ProfileSettings;
