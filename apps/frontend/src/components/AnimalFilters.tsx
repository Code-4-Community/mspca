import { useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
  Flex,
  Icon,
  Popover,
  Portal,
  Text,
} from '@chakra-ui/react';
import { ListFilter, X } from 'lucide-react';

import {
  ANIMAL_TYPES,
  EMPTY_FILTERS,
  RESTRICTIONS,
  getRestriction,
  type AnimalFilterState,
} from '@utils/animals';

type CategoryKey = keyof AnimalFilterState;

interface AnimalFiltersProps {
  value: AnimalFilterState;
  onChange: (filters: AnimalFilterState) => void;
  // Cities available to filter by, derived from the fetched animals.
  locations: string[];
}

const ChevronIcon: React.FC<{ open: boolean }> = ({ open }) => (
  <Icon
    asChild
    boxSize="6"
    color="neutrals.black"
    transform={open ? 'rotate(-180deg)' : undefined}
  >
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  </Icon>
);

interface FilterOption {
  label: string;
  // Fill color of the checkbox when checked (theme token).
  color: string;
}

interface FilterSectionProps {
  title: string;
  options: readonly FilterOption[];
  selected: string[];
  onToggle: (option: string) => void;
}

const FilterSection: React.FC<FilterSectionProps> = ({
  title,
  options,
  selected,
  onToggle,
}) => {
  const [open, setOpen] = useState(false);

  return (
    <Flex alignSelf="stretch" direction="column" align="flex-start" gap="4">
      <Flex alignSelf="stretch" direction="column" align="flex-start" gap="2">
        <Flex
          as="button"
          alignSelf="stretch"
          justify="space-between"
          align="center"
          cursor="pointer"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          <Text
            color="neutrals.black"
            fontSize="16px"
            fontWeight="semibold"
            lineHeight="24px"
          >
            {title}
          </Text>
          <ChevronIcon open={open} />
        </Flex>
        <Box
          alignSelf="stretch"
          h="0.5"
          bg="neutrals.black"
          borderRadius="full"
        />
      </Flex>
      {open && (
        <Flex
          alignSelf="stretch"
          px="4"
          direction="column"
          justify="flex-start"
          align="stretch"
          gap="4"
        >
          {options.length === 0 ? (
            <Text color="neutrals.black85" fontSize="14px" lineHeight="20px">
              No options available
            </Text>
          ) : (
            options.map((option) => {
              const checked = selected.includes(option.label);
              return (
                <Checkbox.Root
                  key={option.label}
                  checked={checked}
                  onCheckedChange={() => onToggle(option.label)}
                  alignSelf="stretch"
                  justifyContent="flex-start"
                  alignItems="center"
                  gap="2"
                >
                  <Checkbox.HiddenInput />
                  <Checkbox.Control
                    boxSize="4"
                    minW="4"
                    borderRadius="xs"
                    borderWidth="0"
                    bg={checked ? option.color : 'transparent'}
                    outline={checked ? 'none' : '1px solid'}
                    outlineColor="border"
                    color="neutral.contrast"
                  >
                    <Checkbox.Indicator />
                  </Checkbox.Control>
                  <Checkbox.Label
                    color="neutrals.black"
                    fontSize="14px"
                    fontWeight="medium"
                    lineHeight="20px"
                    whiteSpace="nowrap"
                  >
                    {option.label}
                  </Checkbox.Label>
                </Checkbox.Root>
              );
            })
          )}
        </Flex>
      )}
    </Flex>
  );
};

const PanelButton: React.FC<{
  onClick: () => void;
  children: React.ReactNode;
}> = ({ onClick, children }) => (
  <Button
    h="10"
    minW="10"
    px="4"
    py="0.5"
    gap="2"
    bg="neutral.subtle"
    color="neutral.fg"
    borderRadius="sm"
    overflow="hidden"
    fontSize="14px"
    fontWeight="semibold"
    lineHeight="20px"
    _hover={{ bg: 'neutral.muted' }}
    onClick={onClick}
  >
    {children}
  </Button>
);

const AnimalFilters: React.FC<AnimalFiltersProps> = ({
  value,
  onChange,
  locations,
}) => {
  const [open, setOpen] = useState(false);
  // Edits are held in a draft until Apply is pressed.
  const [draft, setDraft] = useState<AnimalFilterState>(value);

  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) setDraft(value);
    setOpen(isOpen);
  };

  const toggleDraft = (key: CategoryKey, option: string) =>
    setDraft((prev) => ({
      ...prev,
      [key]: prev[key].includes(option)
        ? prev[key].filter((o) => o !== option)
        : [...prev[key], option],
    }));

  // While the panel is open the chips mirror the draft selection, so they show
  // up immediately as options are ticked. Apply is what filters the grid.
  const shown = open ? draft : value;

  const removeChip = (key: CategoryKey, option: string) => {
    const next = { ...shown, [key]: shown[key].filter((o) => o !== option) };
    if (open) setDraft(next);
    else onChange(next);
  };

  // Animal type selections filter the grid but don't get a chip.
  const chips = (Object.keys(shown) as CategoryKey[])
    .filter((key) => key !== 'types')
    .flatMap((key) =>
      shown[key].map((label) => ({
        key,
        label,
        color:
          key === 'restrictions'
            ? getRestriction(label)?.color ?? 'neutrals.black'
            : 'neutrals.black',
      })),
    );

  return (
    <Flex align="center" gap="3" wrap="wrap">
      <Flex align="center" gap="2">
        <Popover.Root
          open={open}
          onOpenChange={(e) => handleOpenChange(e.open)}
          positioning={{ placement: 'bottom-start' }}
        >
          <Popover.Trigger asChild>
            <Button
              aria-label="Filters"
              w="14"
              h="11"
              minW="11"
              px="5"
              py="0.5"
              gap="3"
              bg="blue.blue3"
              borderRadius="12px"
              overflow="hidden"
            >
              <ListFilter
                size={20}
                strokeWidth={1.5}
                color="white"
                aria-hidden
              />
            </Button>
          </Popover.Trigger>
          <Portal>
            <Popover.Positioner>
              <Popover.Content
                w="80"
                h="96"
                maxW="80"
                p="0"
                gap="0"
                bg="bg.panel"
                borderRadius="2xl"
                borderWidth="0"
                boxShadow="card"
                flexDirection="column"
                justifyContent="space-between"
                alignItems="flex-start"
              >
                <Flex
                  w="80"
                  flex="1"
                  minH="0"
                  direction="column"
                  justify="flex-start"
                  align="flex-start"
                >
                  <Flex
                    alignSelf="stretch"
                    h="16"
                    px="6"
                    pt="6"
                    pb="4"
                    justify="space-between"
                    align="center"
                  >
                    <Text
                      flex="1"
                      color="text.fg"
                      fontSize="18px"
                      fontWeight="bold"
                      lineHeight="28px"
                    >
                      Filters
                    </Text>
                  </Flex>
                  <Flex
                    alignSelf="stretch"
                    flex="1"
                    minH="0"
                    px="6"
                    py="2"
                    direction="column"
                    justify="flex-start"
                    align="flex-start"
                    gap="2.5"
                    overflowY="auto"
                  >
                    <FilterSection
                      title="Animal Type"
                      options={ANIMAL_TYPES.map((label) => ({
                        label,
                        color: 'neutral.solid',
                      }))}
                      selected={draft.types}
                      onToggle={(o) => toggleDraft('types', o)}
                    />
                    <FilterSection
                      title="Restrictions"
                      options={RESTRICTIONS}
                      selected={draft.restrictions}
                      onToggle={(o) => toggleDraft('restrictions', o)}
                    />
                    <FilterSection
                      title="Location"
                      options={locations.map((label) => ({
                        label,
                        color: 'neutral.solid',
                      }))}
                      selected={draft.locations}
                      onToggle={(o) => toggleDraft('locations', o)}
                    />
                  </Flex>
                  <Flex
                    alignSelf="stretch"
                    h="16"
                    px="6"
                    pt="2"
                    pb="4"
                    justify="flex-end"
                    align="center"
                    gap="4"
                  >
                    <PanelButton onClick={() => handleOpenChange(false)}>
                      Cancel
                    </PanelButton>
                    <PanelButton
                      onClick={() => {
                        onChange(draft);
                        setOpen(false);
                      }}
                    >
                      Apply
                    </PanelButton>
                  </Flex>
                </Flex>
              </Popover.Content>
            </Popover.Positioner>
          </Portal>
        </Popover.Root>
        <Button
          variant="outline"
          h="11"
          minW="11"
          px="5"
          py="0.5"
          gap="3"
          border="none"
          borderRadius="12px"
          outline="1px solid"
          outlineColor="neutral.muted"
          outlineOffset="-1px"
          overflow="hidden"
          color="neutral.fg"
          fontSize="16px"
          fontWeight="semibold"
          lineHeight="24px"
          onClick={() => {
            setDraft(EMPTY_FILTERS);
            onChange(EMPTY_FILTERS);
          }}
        >
          Clear Filters
        </Button>
      </Flex>
      {chips.map((chip) => (
        <Button
          key={`${chip.key}-${chip.label}`}
          h="auto"
          px="4"
          py="2.5"
          gap="2.5"
          bg={chip.color}
          color="white"
          borderRadius="12px"
          fontSize="16px"
          fontWeight="semibold"
          lineHeight="24px"
          onClick={() => removeChip(chip.key, chip.label)}
          aria-label={`Remove ${chip.label} filter`}
        >
          <X size={12} strokeWidth={2} color="white" aria-hidden />
          {chip.label}
        </Button>
      ))}
    </Flex>
  );
};

export default AnimalFilters;
