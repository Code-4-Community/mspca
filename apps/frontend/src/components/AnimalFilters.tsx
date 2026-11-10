import { useEffect, useRef, useState } from 'react';
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
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ListFilter,
  X,
} from 'lucide-react';

import {
  ANIMAL_TYPES,
  EMPTY_FILTERS,
  RESTRICTIONS,
  getRestriction,
  type AnimalFilterState,
} from '@utils/animals';
import type { Homebase, Restriction } from '../types';

type CategoryKey = keyof AnimalFilterState;

interface AnimalFiltersProps {
  value: AnimalFilterState;
  onChange: (filters: AnimalFilterState) => void;
  // Homebases available to filter by, derived from the fetched animals.
  locations: Homebase[];
}

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

/**
 * One collapsible group of checkboxes inside the filters popover (e.g. "Animal
 * Type"). Clicking the title expands or collapses its options; ticking one
 * calls `onToggle` with that option's label. Each option's checkbox is filled
 * with its own `color` when checked.
 */
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
          <Text color="neutrals.black" textStyle="h7">
            {title}
          </Text>
          <Icon
            asChild
            boxSize="6"
            color="neutrals.black"
            transform={open ? 'rotate(-180deg)' : undefined}
          >
            <ChevronDown strokeWidth={2} aria-hidden />
          </Icon>
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
          {options.map((option) => {
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
          })}
        </Flex>
      )}
    </Flex>
  );
};

/** Small grey action button used for "Cancel" and "Apply" in the popover footer. */
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

/** Arrow button that scrolls the row of filter chips left or right. */
const ChipScrollButton: React.FC<{
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ label, onClick, children }) => (
  <Button
    aria-label={label}
    flex="none"
    boxSize="10"
    minW="10"
    p="0"
    bg="neutral.subtle"
    color="neutral.fg"
    borderRadius="sm"
    _hover={{ bg: 'neutral.muted' }}
    onClick={onClick}
  >
    {children}
  </Button>
);

/**
 * The filter bar above the animal grid.
 *
 * A filter button opens a popover with collapsible sections for Animal Type,
 * Restrictions and Location. Selections are held as a draft while the popover
 * is open and only filter the grid once Apply is pressed (`onChange` is called
 * with the new `AnimalFilterState`). Next to the button, "Clear Filters" resets
 * everything, and each selected restriction or location is shown as a chip
 * that removes itself when clicked. The chips stay on a single row; when there
 * are too many to fit, arrow buttons appear to scroll through them. Animal
 * type selections filter the grid but don't get a chip.
 */
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
    setDraft((prev) => {
      const selected: string[] = prev[key];
      return {
        ...prev,
        [key]: selected.includes(option)
          ? selected.filter((o) => o !== option)
          : [...selected, option],
      };
    });

  // While the panel is open the chips mirror the draft selection, so they show
  // up immediately as options are ticked. Apply is what filters the grid.
  const shown = open ? draft : value;

  const removeChip = (key: CategoryKey, option: string) => {
    const selected: string[] = shown[key];
    const next = { ...shown, [key]: selected.filter((o) => o !== option) };
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
            ? getRestriction(label as Restriction).color
            : 'neutrals.black',
      })),
    );

  const chipsRef = useRef<HTMLDivElement>(null);
  const [scrollable, setScrollable] = useState({ left: false, right: false });

  const updateScrollable = () => {
    const el = chipsRef.current;
    if (!el) return;
    setScrollable({
      left: el.scrollLeft > 0,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 1,
    });
  };

  // Re-measure whenever the chips change or the window is resized.
  useEffect(() => {
    updateScrollable();
    window.addEventListener('resize', updateScrollable);
    return () => window.removeEventListener('resize', updateScrollable);
  }, [chips.length]);

  const scrollChips = (direction: 1 | -1) =>
    chipsRef.current?.scrollBy({ left: direction * 200, behavior: 'smooth' });

  return (
    <Flex align="center" gap="3">
      <Flex align="center" gap="2" flex="none">
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
      <Flex align="center" gap="2" flex="1" minW="0">
        {scrollable.left && (
          <ChipScrollButton
            label="Scroll filters left"
            onClick={() => scrollChips(-1)}
          >
            <ChevronLeft size={20} aria-hidden />
          </ChipScrollButton>
        )}
        <Flex
          ref={chipsRef}
          onScroll={updateScrollable}
          align="center"
          gap="3"
          flex="1"
          minW="0"
          overflowX="hidden"
        >
          {chips.map((chip) => (
            <Button
              key={`${chip.key}-${chip.label}`}
              flex="none"
              whiteSpace="nowrap"
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
        {scrollable.right && (
          <ChipScrollButton
            label="Scroll filters right"
            onClick={() => scrollChips(1)}
          >
            <ChevronRight size={20} aria-hidden />
          </ChipScrollButton>
        )}
      </Flex>
    </Flex>
  );
};

export default AnimalFilters;
