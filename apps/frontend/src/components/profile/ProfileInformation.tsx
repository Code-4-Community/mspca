import { useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
  Flex,
  Icon,
  IconButton,
  Input,
  NativeSelect,
  Portal,
  Text,
  Textarea,
  Tooltip,
} from '@chakra-ui/react';
import { isAxiosError } from 'axios';
import { Info, Plus, Save, SquarePen, SquareX, Trash2 } from 'lucide-react';

import apiClient from '@api/apiClient';
import {
  FosterType,
  type Pet,
  type UpdateVolunteerBody,
  type Volunteer,
} from '../../types';
import { HOMEBASE_LABELS } from '@utils/animals';
import type { ApiData } from '@utils/useApiData';
import { ErrorState, LoadingState } from './FetchStates';

// A pet while it's being edited; selects start empty until the volunteer
// picks a value.
interface PetForm {
  species: FosterType | '';
  breed: string;
  ageYear: number | null;
  ageMonth: number | null;
}

// The fields a volunteer can edit on this card. Everything else on their
// profile is read-only for them.
interface FormValues {
  address: string;
  city: string;
  zipcode: string;
  livelyNeighborhood: boolean;
  hasSeparateFosterRoom: boolean;
  hasChildren: boolean;
  childrenAges: (number | null)[];
  // The backend has no "has pets" field; Yes just means the list isn't empty.
  hasPets: boolean;
  pets: PetForm[];
  notes: string;
}

// Keyed by field name, or e.g. `child.0` / `pet.1.breed` for list items.
type FormErrors = Partial<Record<string, string>>;

const CHILD_AGE_OPTIONS = Array.from({ length: 18 }, (_, i) => i);
const PET_YEAR_OPTIONS = Array.from({ length: 31 }, (_, i) => i);
const PET_MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => i);
const SPECIES_OPTIONS: readonly FosterType[] = Object.values(FosterType);

const formatYears = (n: number) => `${n} ${n === 1 ? 'year' : 'years'}`;
const formatMonths = (n: number) => `${n} ${n === 1 ? 'month' : 'months'}`;

const NEIGHBORHOOD_HELP =
  'Is your neighborhood quiet and open or lively with people and animals?';

const EMPTY_PET: PetForm = {
  species: '',
  breed: '',
  ageYear: null,
  ageMonth: null,
};

const toFormValues = (volunteer: Volunteer): FormValues => ({
  address: volunteer.address,
  city: volunteer.city,
  zipcode: volunteer.zipcode,
  livelyNeighborhood: volunteer.livelyNeighborhood,
  hasSeparateFosterRoom: volunteer.hasSeparateFosterRoom,
  hasChildren: volunteer.hasChildren,
  childrenAges: [...volunteer.childrenAges],
  hasPets: volunteer.pets.length > 0,
  pets: volunteer.pets.map(({ species, breed, ageYear, ageMonth }) => ({
    species,
    breed,
    ageYear,
    ageMonth,
  })),
  notes: volunteer.notes ?? '',
});

// Mirrors the backend's UpdateVolunteerDto and PetDto rules so mistakes are
// caught before saving.
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

  if (values.hasChildren) {
    if (values.childrenAges.length === 0)
      errors.children = 'Add at least one child, or select No.';
    values.childrenAges.forEach((age, i) => {
      if (age === null) errors[`child.${i}`] = 'Select an age.';
    });
  }

  if (values.hasPets) {
    if (values.pets.length === 0)
      errors.pets = 'Add at least one pet, or select No.';
    values.pets.forEach((pet, i) => {
      if (!pet.species) errors[`pet.${i}.species`] = 'Select a species.';
      if (!pet.breed.trim()) errors[`pet.${i}.breed`] = 'Breed is required.';
      else if (pet.breed.trim().length > 255)
        errors[`pet.${i}.breed`] = 'Breed must be 255 characters or fewer.';
      if (pet.ageYear === null || pet.ageMonth === null)
        errors[`pet.${i}.age`] = 'Select years and months.';
    });
  }
  return errors;
};

const sameJson = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);

// Only the fields that changed are sent, since the endpoint updates
// whatever it's given. Call after `validate` passes.
const toUpdateBody = (
  values: FormValues,
  volunteer: Volunteer,
): UpdateVolunteerBody => {
  const body: UpdateVolunteerBody = {};
  (['address', 'city', 'zipcode'] as const).forEach((key) => {
    const value = values[key].trim();
    if (value !== volunteer[key]) body[key] = value;
  });

  if (values.livelyNeighborhood !== volunteer.livelyNeighborhood)
    body.livelyNeighborhood = values.livelyNeighborhood;
  if (values.hasSeparateFosterRoom !== volunteer.hasSeparateFosterRoom)
    body.hasSeparateFosterRoom = values.hasSeparateFosterRoom;

  // Sent together, since the backend requires ages exactly when
  // hasChildren is true.
  const childrenAges = values.hasChildren
    ? (values.childrenAges as number[])
    : [];
  if (
    values.hasChildren !== volunteer.hasChildren ||
    !sameJson(childrenAges, volunteer.childrenAges)
  ) {
    body.hasChildren = values.hasChildren;
    body.childrenAges = childrenAges;
  }

  const pets: Pet[] = values.hasPets
    ? values.pets.map((pet) => ({
        species: pet.species as FosterType,
        breed: pet.breed.trim(),
        ageYear: pet.ageYear as number,
        ageMonth: pet.ageMonth as number,
      }))
    : [];
  const savedPets: Pet[] = volunteer.pets.map(
    ({ species, breed, ageYear, ageMonth }) => ({
      species,
      breed,
      ageYear,
      ageMonth,
    }),
  );
  if (!sameJson(pets, savedPets)) body.pets = pets;

  const notes = values.notes.trim() || null;
  if (notes !== (volunteer.notes ?? null)) body.notes = notes;

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

const ErrorText: React.FC<{ children?: string }> = ({ children }) =>
  children ? (
    <Text color="fg.error" fontSize="12px" lineHeight="16px">
      {children}
    </Text>
  ) : null;

const RequiredLabel: React.FC<{ label: string; required?: boolean }> = ({
  label,
  required,
}) => (
  <Text color="black" fontSize="14px" fontWeight="semibold" lineHeight="20px">
    {label}
    {required && (
      <Text as="span" color="error.100">
        *
      </Text>
    )}
  </Text>
);

const Field: React.FC<{
  label: string;
  w?: string;
  required?: boolean;
  error?: string;
  // Shown after the label, e.g. a help icon.
  labelExtra?: React.ReactNode;
  children: React.ReactNode;
}> = ({ label, w, required, error, labelExtra, children }) => (
  <Flex
    direction="column"
    gap="1.5"
    w={w}
    alignSelf={w ? undefined : 'stretch'}
  >
    <Flex align="center" gap="1">
      <RequiredLabel label={label} required={required} />
      {labelExtra}
    </Flex>
    {children}
    <ErrorText>{error}</ErrorText>
  </Flex>
);

const HelpTooltip: React.FC<{ text: string }> = ({ text }) => (
  <Tooltip.Root openDelay={100} positioning={{ placement: 'bottom-start' }}>
    <Tooltip.Trigger asChild>
      <Box as="span" display="inline-flex" cursor="help" aria-label={text}>
        <Icon asChild boxSize="4" color="gray.600">
          <Info strokeWidth={1.5} aria-hidden />
        </Icon>
      </Box>
    </Tooltip.Trigger>
    <Portal>
      <Tooltip.Positioner>
        <Tooltip.Content
          maxW="44"
          px="1.5"
          py="1"
          bg="gray.50"
          color="fg.muted"
          borderWidth="1px"
          borderColor="gray.600"
          borderRadius="0"
          boxShadow="none"
          fontSize="9px"
          lineHeight="16px"
        >
          {text}
        </Tooltip.Content>
      </Tooltip.Positioner>
    </Portal>
  </Tooltip.Root>
);

/**
 * A pair of checkboxes that act like radio buttons (e.g. Yes/No), styled
 * like the Figma checkboxes. Without `onChange` it's read-only, and the
 * unselected option is grayed out.
 */
const ChoicePair: React.FC<{
  label: string;
  options: [string, string];
  // true selects the first option, false the second.
  value: boolean;
  onChange?: (value: boolean) => void;
  disabled?: boolean;
  gap: string;
}> = ({ label, options, value, onChange, disabled, gap }) => (
  <Flex h="8" align="center" gap={gap} role="radiogroup" aria-label={label}>
    {options.map((option, i) => {
      const optionValue = i === 0;
      const checked = value === optionValue;
      return (
        <Checkbox.Root
          key={option}
          size="lg"
          checked={checked}
          onCheckedChange={() => onChange?.(optionValue)}
          readOnly={!onChange}
          cursor={onChange ? undefined : 'default'}
          disabled={disabled}
        >
          <Checkbox.HiddenInput />
          <Checkbox.Control
            bg="whiteAlpha.900"
            borderColor="border"
            borderRadius="xs"
            _checked={{ bg: 'blue.blue3', borderColor: 'blue.blue3' }}
          />
          <Checkbox.Label
            color={!onChange && !checked ? 'gray.300' : 'neutrals.black'}
            fontSize="14px"
            fontWeight="medium"
            lineHeight="20px"
          >
            {option}
          </Checkbox.Label>
        </Checkbox.Root>
      );
    })}
  </Flex>
);

const NumberSelect: React.FC<{
  label: string;
  w: string;
  value: number | null;
  options: number[];
  format: (n: number) => string;
  placeholder: string;
  onChange: (value: number | null) => void;
  disabled?: boolean;
  invalid?: boolean;
}> = ({
  label,
  w,
  value,
  options,
  format,
  placeholder,
  onChange,
  disabled,
  invalid,
}) => (
  <NativeSelect.Root w={w} size="sm" disabled={disabled}>
    <NativeSelect.Field
      {...fieldStyles}
      h="8"
      color="fg.muted"
      aria-label={label}
      aria-invalid={invalid || undefined}
      value={value === null ? '' : String(value)}
      onChange={(e) =>
        onChange(e.target.value === '' ? null : Number(e.target.value))
      }
    >
      <option value="">{placeholder}</option>
      {options.map((n) => (
        <option key={n} value={n}>
          {format(n)}
        </option>
      ))}
    </NativeSelect.Field>
    <NativeSelect.Indicator color="neutral.fg" />
  </NativeSelect.Root>
);

const RemoveButton: React.FC<{
  label: string;
  onClick: () => void;
  disabled?: boolean;
}> = ({ label, onClick, disabled }) => (
  <IconButton
    aria-label={label}
    variant="plain"
    size="2xs"
    minW="4"
    h="4"
    color="gray.400"
    _hover={{ color: 'gray.600' }}
    onClick={onClick}
    disabled={disabled}
  >
    <Icon asChild boxSize="4">
      <Trash2 strokeWidth={2} aria-hidden />
    </Icon>
  </IconButton>
);

const AddButton: React.FC<{
  label: string;
  onClick: () => void;
  disabled?: boolean;
}> = ({ label, onClick, disabled }) => (
  <Button
    variant="outline"
    flexShrink={0}
    w="24"
    h="14"
    p="0"
    gap="0"
    bg="gray.100"
    borderRadius="sm"
    borderWidth="1.5px"
    borderColor="neutral.muted"
    overflow="hidden"
    aria-label={`Add ${label}`}
    onClick={onClick}
    disabled={disabled}
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

// Bordered card around one child or pet. Without `onRemove` it's the
// read-only version: no asterisk and no remove button.
const ItemCard: React.FC<{
  title: string;
  w: string;
  onRemove?: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}> = ({ title, w, onRemove, disabled, children }) => (
  <Flex
    direction="column"
    gap="1"
    w={w}
    p="2.5"
    borderRadius="md"
    borderWidth="1px"
    borderColor="gray.300"
  >
    <Flex justify="space-between" align="flex-start" pb="1">
      <RequiredLabel label={title} required={!!onRemove} />
      {onRemove && (
        <RemoveButton
          label={`Remove ${title}`}
          onClick={onRemove}
          disabled={disabled}
        />
      )}
    </Flex>
    {children}
  </Flex>
);

// A saved value shown as text on a read-only child or pet card.
const ReadOnlyValue: React.FC<{ children: string }> = ({ children }) => (
  <Text h="8" color="fg.muted" fontSize="14px" lineHeight="20px">
    {children}
  </Text>
);

const ItemRow: React.FC<{
  label: string;
  labelW: string;
  gap: string;
  children: React.ReactNode;
}> = ({ label, labelW, gap, children }) => (
  <Flex align="center" gap={gap}>
    <Text
      flexShrink={0}
      w={labelW}
      color="black"
      fontSize="14px"
      fontWeight="medium"
      lineHeight="20px"
    >
      {label}
    </Text>
    {children}
  </Flex>
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
 * Settings tab. View mode shows the volunteer's address, homebase and
 * household details read-only, with a card per child and pet. "Edit"
 * switches to the edit layout, and "Save Changes" sends only the changed
 * fields to the update endpoint.
 *
 * In edit mode, choosing Yes for Children or Pets shows a card per child or
 * pet, with buttons to add and remove them. Household Type (edit mode only)
 * isn't in the schema yet, so its control is shown empty and disabled. The
 * homebase isn't editable here, since changing it reassigns coordinators.
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

  const update = (patch: (prev: FormValues) => Partial<FormValues>) =>
    setValues((prev) => (prev ? { ...prev, ...patch(prev) } : prev));

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

  const inputProps = (key: 'address' | 'city' | 'zipcode') => ({
    ...fieldStyles,
    h: '8',
    value: shown[key],
    readOnly: !editing,
    disabled: saving,
    color: editing ? 'black' : 'fg.muted',
    'aria-invalid': errors[key] ? true : undefined,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      const next = e.target.value;
      update(() => ({ [key]: next }));
    },
  });

  // Choosing Yes with nothing listed adds a blank card to fill in.
  const setHasChildren = (hasChildren: boolean) =>
    update((prev) => ({
      hasChildren,
      childrenAges:
        hasChildren && prev.childrenAges.length === 0
          ? [null]
          : prev.childrenAges,
    }));
  const setHasPets = (hasPets: boolean) =>
    update((prev) => ({
      hasPets,
      pets: hasPets && prev.pets.length === 0 ? [{ ...EMPTY_PET }] : prev.pets,
    }));

  const setChildAge = (index: number, age: number | null) =>
    update((prev) => ({
      childrenAges: prev.childrenAges.map((a, i) => (i === index ? age : a)),
    }));
  const setPet = (index: number, patch: Partial<PetForm>) =>
    update((prev) => ({
      pets: prev.pets.map((p, i) => (i === index ? { ...p, ...patch } : p)),
    }));

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

  const notesField = (
    <Field label="Household Notes">
      <Textarea
        {...fieldStyles}
        h="20"
        resize="none"
        readOnly={!editing}
        disabled={saving}
        color={editing ? 'black' : 'fg.muted'}
        value={shown.notes}
        onChange={(e) => {
          const next = e.target.value;
          update(() => ({ notes: next }));
        }}
      />
    </Field>
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

          <Flex gap="7" align="flex-start">
            {/* TODO: wire up once the backend has a household type. */}
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
              label="Neighborhood Type"
              w="44"
              required
              labelExtra={<HelpTooltip text={NEIGHBORHOOD_HELP} />}
            >
              <ChoicePair
                label="Neighborhood Type"
                options={['Quiet', 'Lively']}
                value={!shown.livelyNeighborhood}
                onChange={(quiet) =>
                  update(() => ({ livelyNeighborhood: !quiet }))
                }
                disabled={saving}
                gap="6"
              />
            </Field>
            <Field
              label="Do you have a separate room for fosters?"
              w="80"
              required
            >
              <ChoicePair
                label="Separate room for fosters"
                options={['Yes', 'No']}
                value={shown.hasSeparateFosterRoom}
                onChange={(hasSeparateFosterRoom) =>
                  update(() => ({ hasSeparateFosterRoom }))
                }
                disabled={saving}
                gap="6"
              />
            </Field>
          </Flex>

          <Flex gap="7" align="flex-start">
            <Field label="Children" w="36" required error={errors.children}>
              <ChoicePair
                label="Children"
                options={['Yes', 'No']}
                value={shown.hasChildren}
                onChange={setHasChildren}
                disabled={saving}
                gap="4"
              />
            </Field>
            <Field label="Pets" w="32" required error={errors.pets}>
              <ChoicePair
                label="Pets"
                options={['Yes', 'No']}
                value={shown.hasPets}
                onChange={setHasPets}
                disabled={saving}
                gap="4"
              />
            </Field>
          </Flex>

          {shown.hasChildren && (
            <Flex gap="5" align="center" wrap="wrap">
              {shown.childrenAges.map((age, i) => (
                <ItemCard
                  key={i}
                  title={`Child ${i + 1}`}
                  w="40"
                  disabled={saving}
                  onRemove={() =>
                    update((prev) => ({
                      childrenAges: prev.childrenAges.filter((_, j) => j !== i),
                    }))
                  }
                >
                  <ItemRow label="Age" labelW="7" gap="2.5">
                    <NumberSelect
                      label={`Child ${i + 1} age`}
                      w="28"
                      value={age}
                      options={CHILD_AGE_OPTIONS}
                      format={formatYears}
                      placeholder="Select"
                      onChange={(next) => setChildAge(i, next)}
                      disabled={saving}
                      invalid={!!errors[`child.${i}`]}
                    />
                  </ItemRow>
                  <ErrorText>{errors[`child.${i}`]}</ErrorText>
                </ItemCard>
              ))}
              <AddButton
                label="Child"
                disabled={saving}
                onClick={() =>
                  update((prev) => ({
                    childrenAges: [...prev.childrenAges, null],
                  }))
                }
              />
            </Flex>
          )}

          {shown.hasPets && (
            <Flex gap="3.5" align="center" wrap="wrap">
              {shown.pets.map((pet, i) => (
                <ItemCard
                  key={i}
                  title={`Pet ${i + 1}`}
                  w="72"
                  disabled={saving}
                  onRemove={() =>
                    update((prev) => ({
                      pets: prev.pets.filter((_, j) => j !== i),
                    }))
                  }
                >
                  <Flex direction="column" gap="1.5">
                    <ItemRow label="Species" labelW="14" gap="2.5">
                      <NativeSelect.Root flex="1" size="sm" disabled={saving}>
                        <NativeSelect.Field
                          {...fieldStyles}
                          h="8"
                          color="fg.muted"
                          aria-label={`Pet ${i + 1} species`}
                          aria-invalid={
                            !!errors[`pet.${i}.species`] || undefined
                          }
                          value={pet.species}
                          onChange={(e) =>
                            setPet(i, {
                              species: e.target.value as FosterType | '',
                            })
                          }
                        >
                          <option value="">Select</option>
                          {SPECIES_OPTIONS.map((species) => (
                            <option key={species} value={species}>
                              {species}
                            </option>
                          ))}
                        </NativeSelect.Field>
                        <NativeSelect.Indicator color="neutral.fg" />
                      </NativeSelect.Root>
                    </ItemRow>
                    <ErrorText>{errors[`pet.${i}.species`]}</ErrorText>
                    <ItemRow label="Breed" labelW="14" gap="2.5">
                      <Input
                        {...fieldStyles}
                        flex="1"
                        h="8"
                        color="black"
                        aria-label={`Pet ${i + 1} breed`}
                        aria-invalid={!!errors[`pet.${i}.breed`] || undefined}
                        value={pet.breed}
                        disabled={saving}
                        onChange={(e) => setPet(i, { breed: e.target.value })}
                      />
                    </ItemRow>
                    <ErrorText>{errors[`pet.${i}.breed`]}</ErrorText>
                    <ItemRow label="Age" labelW="14" gap="2.5">
                      <Flex flex="1" gap="1.5">
                        <NumberSelect
                          label={`Pet ${i + 1} age in years`}
                          w="50%"
                          value={pet.ageYear}
                          options={PET_YEAR_OPTIONS}
                          format={formatYears}
                          placeholder="Years"
                          onChange={(ageYear) => setPet(i, { ageYear })}
                          disabled={saving}
                          invalid={!!errors[`pet.${i}.age`]}
                        />
                        <NumberSelect
                          label={`Pet ${i + 1} age in months`}
                          w="50%"
                          value={pet.ageMonth}
                          options={PET_MONTH_OPTIONS}
                          format={formatMonths}
                          placeholder="Months"
                          onChange={(ageMonth) => setPet(i, { ageMonth })}
                          disabled={saving}
                          invalid={!!errors[`pet.${i}.age`]}
                        />
                      </Flex>
                    </ItemRow>
                    <ErrorText>{errors[`pet.${i}.age`]}</ErrorText>
                  </Flex>
                </ItemCard>
              ))}
              <AddButton
                label="Pet"
                disabled={saving}
                onClick={() =>
                  update((prev) => ({ pets: [...prev.pets, { ...EMPTY_PET }] }))
                }
              />
            </Flex>
          )}

          {notesField}
        </Flex>
      ) : (
        <Flex direction="column" gap="4">
          {addressRow}

          <Flex gap="7" align="flex-start">
            <Field label="MSPCA Homebase" w="52">
              <Text color="fg.muted" fontSize="14px" lineHeight="20px">
                {HOMEBASE_LABELS[data.homebase]}
              </Text>
            </Field>
            <Field label="Neighborhood Type" w="44">
              <ChoicePair
                label="Neighborhood Type"
                options={['Quiet', 'Lively']}
                value={!data.livelyNeighborhood}
                gap="6"
              />
            </Field>
            <Field label="Do you have a separate room for fosters?" w="96">
              <ChoicePair
                label="Separate room for fosters"
                options={['Yes', 'No']}
                value={data.hasSeparateFosterRoom}
                gap="6"
              />
            </Field>
          </Flex>

          <Flex gap="7" align="flex-start">
            <Field label="Children" w="36">
              <ChoicePair
                label="Children"
                options={['Yes', 'No']}
                value={data.hasChildren}
                gap="4"
              />
            </Field>
            <Field label="Pets" w="32">
              <ChoicePair
                label="Pets"
                options={['Yes', 'No']}
                value={data.pets.length > 0}
                gap="4"
              />
            </Field>
          </Flex>

          {data.hasChildren && data.childrenAges.length > 0 && (
            <Flex gap="5" align="center" wrap="wrap">
              {data.childrenAges.map((age, i) => (
                <ItemCard key={i} title={`Child ${i + 1}`} w="36">
                  <ItemRow label="Age" labelW="7" gap="2.5">
                    <ReadOnlyValue>{formatYears(age)}</ReadOnlyValue>
                  </ItemRow>
                </ItemCard>
              ))}
            </Flex>
          )}

          {data.pets.length > 0 && (
            <Flex gap="5" align="flex-start" wrap="wrap">
              {data.pets.map((pet, i) => (
                <ItemCard key={i} title={`Pet ${i + 1}`} w="72">
                  <ItemRow label="Species" labelW="14" gap="2.5">
                    <ReadOnlyValue>{pet.species}</ReadOnlyValue>
                  </ItemRow>
                  <ItemRow label="Breed" labelW="14" gap="2.5">
                    <ReadOnlyValue>{pet.breed}</ReadOnlyValue>
                  </ItemRow>
                  <ItemRow label="Age" labelW="14" gap="2.5">
                    <ReadOnlyValue>
                      {`${formatYears(pet.ageYear)}, ${formatMonths(
                        pet.ageMonth,
                      )}`}
                    </ReadOnlyValue>
                  </ItemRow>
                </ItemCard>
              ))}
            </Flex>
          )}

          {notesField}
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
