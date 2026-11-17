import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Flex,
  Heading,
  SimpleGrid,
  Spinner,
  Text,
  useBreakpointValue,
} from '@chakra-ui/react';

import apiClient from '@api/apiClient';
import type { Animal, Homebase } from '../types';
import AnimalCard from '@components/AnimalCard';
import AnimalFilters from '@components/AnimalFilters';
import BottomSheet from '@components/BottomSheet';
import AnimalModal from '@components/modals/AnimalModal';
import HomebaseMap from '@components/HomebaseMap';
import {
  EMPTY_FILTERS,
  matchesFilters,
  type AnimalFilterState,
} from '@utils/animals';

/**
 * Page where volunteers browse the animals that are available to foster.
 *
 * Fetches every animal from the API once and shows them as a grid of
 * `AnimalCard`s inside a panel, with `AnimalFilters` above the grid. Filtering
 * by animal type, restrictions and homebase happens in the browser on the
 * already-fetched list, so the grid updates as soon as filters are applied.
 * Clicking "See More" on a card opens `AnimalModal` for that animal, where the
 * volunteer can submit a match request. While loading it shows a spinner, and
 * if the request fails it shows an error with a "Try again" button. A
 * `HomebaseMap` shows each homebase: clicking its pins toggles the Location
 * filter, and hovering a card highlights that animal's homebase. On large
 * screens the map sits to the right of the cards; on mobile it fills the space
 * under the navbar and the cards sit in a `BottomSheet` over it.
 */
const AnimalAvailability: React.FC = () => {
  // Below the `lg` breakpoint the page switches to the mobile layout.
  const isMobile = useBreakpointValue(
    { base: true, lg: false },
    { ssr: false },
  );
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilters, setActiveFilters] =
    useState<AnimalFilterState>(EMPTY_FILTERS);
  const [selectedAnimal, setSelectedAnimal] = useState<Animal | null>(null);
  const [hoveredHomebase, setHoveredHomebase] = useState<Homebase | null>(null);

  const fetchAnimals = async () => {
    try {
      setAnimals(await apiClient.getAnimals());
    } catch {
      setError('Something went wrong while loading animals.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Fetching on mount; the state updates happen after the request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAnimals();
  }, []);

  // Animals are fetched once; filters are applied here in real time.
  const visibleAnimals = useMemo(
    () => animals.filter((animal) => matchesFilters(animal, activeFilters)),
    [animals, activeFilters],
  );

  const toggleLocation = (homebase: Homebase) =>
    setActiveFilters((filters) => ({
      ...filters,
      locations: filters.locations.includes(homebase)
        ? filters.locations.filter((location) => location !== homebase)
        : [...filters.locations, homebase],
    }));

  const filters = (
    <AnimalFilters value={activeFilters} onChange={setActiveFilters} />
  );

  const map = (
    <HomebaseMap
      selected={activeFilters.locations}
      hovered={hoveredHomebase}
      onToggle={toggleLocation}
    />
  );

  // Spinner, error, empty states or the grid of cards.
  const animalList = loading ? (
    <Flex justify="center" py="20">
      <Spinner size="xl" color="blue.primary" />
    </Flex>
  ) : error ? (
    <Flex direction="column" align="center" gap="4" py="20">
      <Text color="fg.error">{error}</Text>
      <Button
        variant="outline"
        onClick={() => {
          setLoading(true);
          setError(null);
          fetchAnimals();
        }}
      >
        Try again
      </Button>
    </Flex>
  ) : animals.length === 0 ? (
    <Flex direction="column" align="center" gap="2" py="20">
      <Heading as="h2" textStyle="h6" color="neutrals.black">
        No animals available
      </Heading>
      <Text color="neutrals.grey">
        There are no animals matching right now. Please check back soon.
      </Text>
    </Flex>
  ) : visibleAnimals.length === 0 ? (
    <Flex direction="column" align="center" gap="4" py="20">
      <Heading as="h2" textStyle="h6" color="neutrals.black">
        No animals match your filters
      </Heading>
      <Button variant="outline" onClick={() => setActiveFilters(EMPTY_FILTERS)}>
        Clear Filters
      </Button>
    </Flex>
  ) : (
    <SimpleGrid columns={{ base: 1, md: 2 }} gap="4" p="1">
      {visibleAnimals.map((animal) => (
        <AnimalCard
          key={animal.animalId}
          animal={animal}
          onSeeMore={setSelectedAnimal}
          onHoverChange={(hovering) =>
            setHoveredHomebase(hovering ? animal.location : null)
          }
        />
      ))}
    </SimpleGrid>
  );

  const modal = (
    <AnimalModal
      animal={selectedAnimal}
      onClose={() => setSelectedAnimal(null)}
    />
  );

  // Mobile: the map fills the space under the navbar and the animals sit in a
  // bottom sheet over it.
  if (isMobile) {
    return (
      <Flex direction="column" flex="1" minH="0" bg="bg.muted">
        <Box px="4" py="3" flex="none">
          {filters}
        </Box>
        <Box position="relative" flex="1" minH="0">
          <Box position="absolute" inset="0">
            {map}
          </Box>
          <BottomSheet>{animalList}</BottomSheet>
        </Box>
        {modal}
      </Flex>
    );
  }

  return (
    <Box bg="bg.muted" flex="1">
      <Flex gap="8" px="8" py="8" align="flex-start">
        <Flex
          direction="column"
          gap="4"
          flex="1"
          minW="0"
          p="4"
          bg="bg.subtle"
          borderRadius="3xl"
          boxShadow="card"
          overflow="hidden"
        >
          {filters}
          {animalList}
        </Flex>

        <Box
          flex="none"
          w="531px"
          h="calc(100vh - 64px)"
          position="sticky"
          top="8"
        >
          {map}
        </Box>
      </Flex>

      {modal}
    </Box>
  );
};

export default AnimalAvailability;
