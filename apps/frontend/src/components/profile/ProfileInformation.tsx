import { useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
  Flex,
  Icon,
  Input,
  NativeSelect,
  Text,
  Textarea,
} from '@chakra-ui/react';
import { isAxiosError } from 'axios';
import { Plus, Save, SquarePen, SquareX } from 'lucide-react';

import apiClient from '@api/apiClient';
import type { UpdateVolunteerBody, Volunteer } from '../../types';
import type { ApiData } from '@utils/useApiData';
import { ErrorState, LoadingState } from './FetchStates';

// The fields a volunteer can edit on this card. Everything else on their
// profile is read-only for them.
interface FormValues {
  address: string;
  city: string;
  zipcode: string;
}

type FormErrors = Partial<Record<keyof FormValues, string>>;

const toFormValues = (volunteer: Volunteer): FormValues => ({
  address: volunteer.address,
  city: volunteer.city,
  zipcode: volunteer.zipcode,
});

// Mirrors the backend's UpdateVolunteerDto rules so mistakes are caught
// before saving.
const validate = (values: FormValues): FormErrors => {
  const errors: FormErrors = {};
  if (!values.address.trim()) errors.address = 'Address is required.';
  else if (values.address.trim().length > 255)
    errors.address = 'Address must be 255 characters or fewer.';
  if (!values.city.trim()) errors.city = 'City is required.';
  else if (values.city.trim().length > 255)
    errors.city = 'City must be 255 characters or fewer.';
  if (!values.zipcode.trim()) errors.zipcode = 'Zipcode is required.';
  else if (values.zipcode.trim().length > 10)
    errors.zipcode = 'Zipcode must be 10 characters or fewer.';
  return errors;
};

// Only the fields that changed are sent, since the endpoint updates
// whatever it's given.
const toUpdateBody = (
  values: FormValues,
  volunteer: Volunteer,
): UpdateVolunteerBody => {
  const body: UpdateVolunteerBody = {};
  (Object.keys(values) as (keyof FormValues)[]).forEach((key) => {
    const value = values[key].trim();
    if (value !== volunteer[key]) body[key] = value;
  });
  return body;
};

const getSaveErrorMessage = (err: unknown): string => {
  const message = isAxiosError(err) ? err.response?.data?.message : undefined;
  if (Array.isArray(message)) return message.join(' ');
  if (typeof message === 'string') return message;
  return 'Could not save your changes. Please try again.';
};

const fieldStyles = {
  bg: 'gray.0',
  borderColor: 'gray.300',
  borderRadius: '5px',
  fontSize: '14px',
  lineHeight: '20px',
  px: '2.5',
} as const;

// Styles for controls whose data isn't in the schema yet; never editable.
const unavailableStyles = {
  disabled: true,
  _disabled: { opacity: 1, cursor: 'not-allowed' },
} as const;

const Field: React.FC<{
  label: string;
  w?: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}> = ({ label, w, required, error, children }) => (
  <Flex
    direction="column"
    gap="1.5"
    w={w}
    alignSelf={w ? undefined : 'stretch'}
  >
    <Text color="black" fontSize="14px" fontWeight="semibold" lineHeight="20px">
      {label}
      {required && (
        <Text as="span" color="error.100">
          *
        </Text>
      )}
    </Text>
    {children}
    {error && (
      <Text color="fg.error" fontSize="12px" lineHeight="16px">
        {error}
      </Text>
    )}
  </Flex>
);

const UnavailableInput: React.FC<{ label: string }> = ({ label }) => (
  <Input
    {...fieldStyles}
    {...unavailableStyles}
    h="8"
    value="—"
    aria-label={label}
    readOnly
    color="fg.subtle"
  />
);

const UnavailableYesNo: React.FC<{ label: string }> = ({ label }) => (
  <Flex h="8" align="center" gap="4" role="group" aria-label={label}>
    {['Yes', 'No'].map((option) => (
      <Checkbox.Root key={option} size="lg" disabled cursor="not-allowed">
        <Checkbox.HiddenInput />
        <Checkbox.Control
          bg="whiteAlpha.900"
          borderColor="border"
          borderRadius="xs"
        />
        <Checkbox.Label
          color="neutrals.black"
          fontSize="14px"
          fontWeight="medium"
          lineHeight="20px"
          opacity={1}
        >
          {option}
        </Checkbox.Label>
      </Checkbox.Root>
    ))}
  </Flex>
);

const UnavailableAddButton: React.FC<{ label: string }> = ({ label }) => (
  <Button
    {...unavailableStyles}
    variant="outline"
    w="24"
    h="14"
    p="0"
    gap="0"
    borderRadius="sm"
    borderWidth="1.5px"
    borderColor="neutral.muted"
    overflow="hidden"
    aria-label={`Add ${label}`}
  >
    <Text
      flex="1"
      textAlign="center"
      color="neutral.fg"
      fontSize="12px"
      fontWeight="medium"
      lineHeight="20px"
      whiteSpace="pre-line"
    >
      {`Add\n${label}`}
    </Text>
    <Flex w="9" h="full" align="center" justify="center" bg="gray.200">
      <Icon asChild boxSize="4" color="neutral.fg">
        <Plus strokeWidth={2} aria-hidden />
      </Icon>
    </Flex>
  </Button>
);

const HeaderButton: React.FC<{
  label: string;
  icon: React.ReactNode;
  primary?: boolean;
  w: string;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
}> = ({ label, icon, primary, w, onClick, disabled, loading }) => (
  <Button
    variant={primary ? 'solid' : 'outline'}
    w={w}
    h="8"
    px="2.5"
    gap="2.5"
    bg={primary ? 'blue.blue3' : 'whiteAlpha.900'}
    borderWidth="1px"
    borderColor={primary ? 'blue.blue2' : 'gray.300'}
    borderRadius="sm"
    color={primary ? 'fg.inverted' : 'fg.muted'}
    fontSize="12px"
    fontWeight="normal"
    lineHeight="16px"
    onClick={onClick}
    disabled={disabled}
    loading={loading}
  >
    {label}
    <Icon asChild boxSize="4" color={primary ? 'white' : 'gray.600'}>
      {icon}
    </Icon>
  </Button>
);

interface ProfileInformationProps {
  volunteer: ApiData<Volunteer>;
}

/**
 * The "Profile Information" card on the Volunteer Profile's Information &
 * Settings tab. View mode shows the volunteer's address and household
 * details. "Edit" switches to the edit layout, and "Save Changes" sends only
 * the changed fields to the update endpoint.
 *
 * Only Address, City and Zipcode are editable on this branch. Household
 * Type, the separate foster room, children and pets aren't in the schema yet
 * (all but Household Type come with MSPCA-56), so their controls are shown
 * empty and disabled.
 */
const ProfileInformation: React.FC<ProfileInformationProps> = ({
  volunteer,
}) => {
  const [values, setValues] = useState<FormValues | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const editing = values !== null;

  if (volunteer.loading) return <LoadingState />;
  if (volunteer.notFound) {
    return <ErrorState message="We couldn't find a volunteer with this ID." />;
  }
  if (volunteer.error || !volunteer.data) {
    return (
      <ErrorState
        message="Something went wrong while loading this profile."
        onRetry={volunteer.reload}
      />
    );
  }

  const data = volunteer.data;
  const shown = values ?? toFormValues(data);

  const startEditing = () => {
    setValues(toFormValues(data));
    setErrors({});
    setSaveError(null);
  };

  const cancel = () => {
    setValues(null);
    setErrors({});
    setSaveError(null);
  };

  const save = async () => {
    if (!values) return;
    const found = validate(values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const body = toUpdateBody(values, data);
    if (Object.keys(body).length === 0) {
      cancel();
      return;
    }

    setSaving(true);
    setSaveError(null);
    try {
      volunteer.setData(
        await apiClient.updateVolunteer(data.volunteerId, body),
      );
      cancel();
    } catch (err) {
      setSaveError(getSaveErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const inputProps = (key: keyof FormValues) => ({
    ...fieldStyles,
    h: '8',
    value: shown[key],
    readOnly: !editing,
    disabled: saving,
    color: editing ? 'black' : 'fg.muted',
    'aria-invalid': errors[key] ? true : undefined,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      const next = e.target.value;
      setValues((prev) => (prev ? { ...prev, [key]: next } : prev));
    },
  });

  const addressRow = (
    <Flex gap="7" align="flex-start">
      <Field label="Address" w="52" required={editing} error={errors.address}>
        <Input {...inputProps('address')} />
      </Field>
      <Field label="City" w="36" required={editing} error={errors.city}>
        <Input {...inputProps('city')} />
      </Field>
      <Field label="Zipcode" w="36" required={editing} error={errors.zipcode}>
        <Input {...inputProps('zipcode')} />
      </Field>
    </Flex>
  );

  return (
    <Flex direction="column" gap="6">
      <Flex justify="space-between" align="center">
        <Text
          color="black"
          fontSize="24px"
          fontWeight="semibold"
          lineHeight="36px"
        >
          Profile Information
        </Text>
        {editing ? (
          <Flex gap="2">
            <HeaderButton
              label="Cancel"
              w="24"
              icon={<SquareX strokeWidth={2} aria-hidden />}
              onClick={cancel}
              disabled={saving}
            />
            <HeaderButton
              label="Save Changes"
              w="32"
              primary
              icon={<Save strokeWidth={1.5} aria-hidden />}
              onClick={save}
              loading={saving}
            />
          </Flex>
        ) : (
          <HeaderButton
            label="Edit"
            w="16"
            icon={<SquarePen strokeWidth={2} aria-hidden />}
            onClick={startEditing}
          />
        )}
      </Flex>

      {editing ? (
        <Flex direction="column" gap="4">
          {addressRow}

          {/* TODO: wire these up once the backend has them. Household Type
              doesn't exist yet; the rest come with MSPCA-56. */}
          <Flex gap="7" align="flex-start">
            <Field label="Household Type" w="52" required>
              <NativeSelect.Root {...unavailableStyles} size="sm">
                <NativeSelect.Field
                  {...fieldStyles}
                  h="8"
                  color="fg.subtle"
                  aria-label="Household Type"
                >
                  <option value="">—</option>
                </NativeSelect.Field>
                <NativeSelect.Indicator color="neutral.fg" />
              </NativeSelect.Root>
            </Field>
            <Field
              label="Do you have a separate room for foster animals?"
              w="96"
              required
            >
              <UnavailableYesNo label="Separate room for foster animals" />
            </Field>
          </Flex>
          <Flex gap="7" align="flex-start">
            <Field label="Children" w="36" required>
              <UnavailableYesNo label="Children" />
            </Field>
            <Field label="Pets" w="36" required>
              <UnavailableYesNo label="Pets" />
            </Field>
          </Flex>
          <Flex gap="7" align="flex-start">
            <UnavailableAddButton label="Child" />
            <UnavailableAddButton label="Pet" />
          </Flex>
        </Flex>
      ) : (
        <Flex direction="column" gap="4">
          {addressRow}

          {/* TODO: Household Type, Children and Pets aren't in the schema yet
              (Children and Pets come with MSPCA-56). */}
          <Flex gap="7" align="flex-start">
            <Field label="Household Type" w="52">
              <UnavailableInput label="Household Type" />
            </Field>
            <Field label="Children" w="36">
              <UnavailableInput label="Children" />
            </Field>
            <Field label="Pets" w="36">
              <UnavailableInput label="Pets" />
            </Field>
          </Flex>

          <Field label="Household Notes">
            <Textarea
              {...fieldStyles}
              h="20"
              resize="none"
              readOnly
              color="fg.muted"
              value={data.notes ?? ''}
            />
          </Field>
          <Field label="Pet Notes">
            <Textarea
              {...fieldStyles}
              h="20"
              resize="none"
              readOnly
              color="fg.muted"
              value={data.residentAnimals}
            />
          </Field>
        </Flex>
      )}

      {saveError && (
        <Box>
          <Text color="fg.error">{saveError}</Text>
        </Box>
      )}
    </Flex>
  );
};

export default ProfileInformation;
