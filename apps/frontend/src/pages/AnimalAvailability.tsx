import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Flex,
  Heading,
  Image,
  SimpleGrid,
  Spinner,
  Text,
} from '@chakra-ui/react';

import apiClient from '@api/apiClient';
import type { Animal } from '../types';
import AnimalCard from '@components/AnimalCard';
import AnimalFilters from '@components/AnimalFilters';
import AnimalModal from '@components/modals/AnimalModal';
import {
  EMPTY_FILTERS,
  matchesFilters,
  type AnimalFilterState,
} from '@utils/animals';
import logo from '../assets/mspca-logo.png';

/**
 * The top bar of the page: the MSPCA logo on the left and the volunteer's
 * profile avatar and "My Profile" label on the right. The initials are
 * hard-coded for now until the logged-in volunteer is available to the
 * frontend.
 */
const PageHeader: React.FC = () => (
  <Flex
    alignSelf="stretch"
    px="8"
    py="4"
    bg="gray.50"
    boxShadow="card"
    justify="space-between"
    align="center"
    overflow="hidden"
  >
    <Image
      src={logo}
      alt="MSPCA - Kindness and Care for Animals"
      w="48"
      h="20"
    />
    <Flex justify="center" align="center" gap="4">
      <Box
        display="flex"
        flexDirection="column"
        justifyContent="center"
        alignItems="center"
        boxSize="16"
        bg="purple.avatar"
        borderRadius="full"
        boxShadow="card"
        outline="3px solid"
        outlineColor="neutrals.black"
        outlineOffset="-3px"
        overflow="hidden"
      >
        {/* TODO: use the logged-in volunteer's initials */}
        <Text
          alignSelf="stretch"
          textAlign="center"
          color="white"
          fontSize="20px"
          fontWeight="semibold"
          lineHeight="32px"
        >
          MW
        </Text>
      </Box>
      <Text
        textAlign="center"
        color="neutrals.black"
        fontSize="2xl"
        fontWeight="semibold"
        lineHeight="36px"
      >
        My Profile
      </Text>
    </Flex>
  </Flex>
);

/**
 * Page where volunteers browse the animals that are available to foster.
 *
 * Fetches every animal from the API once and shows them as a grid of
 * `AnimalCard`s inside a panel, with `AnimalFilters` above the grid. Filtering
 * by animal type, restrictions and homebase happens in the browser on the
 * already-fetched list, so the grid updates as soon as filters are applied.
 * Clicking "See More" on a card opens `AnimalModal` for that animal, where the
 * volunteer can submit a match request. While loading it shows a spinner, and
 * if the request fails it shows an error with a "Try again" button. The space
 * on the right is reserved for the map, which is not built yet.
 */
const AnimalAvailability: React.FC = () => {
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilters, setActiveFilters] =
    useState<AnimalFilterState>(EMPTY_FILTERS);
  const [selectedAnimal, setSelectedAnimal] = useState<Animal | null>(null);

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

  const locations = useMemo(
    () => [...new Set(animals.map((animal) => animal.location))].sort(),
    [animals],
  );

  return (
    <Box bg="bg.muted" minH="100vh">
      <PageHeader />
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
          <AnimalFilters
            value={activeFilters}
            onChange={setActiveFilters}
            locations={locations}
          />

          {loading ? (
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
              <Button
                variant="outline"
                onClick={() => setActiveFilters(EMPTY_FILTERS)}
              >
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
                />
              ))}
            </SimpleGrid>
          )}
        </Flex>

        {/* Space reserved for the map, which is out of scope for this ticket. */}
        <Box
          display={{ base: 'none', lg: 'block' }}
          flex="none"
          w="531px"
          aria-hidden="true"
        />
      </Flex>

      <AnimalModal
        animal={selectedAnimal}
        onClose={() => setSelectedAnimal(null)}
      />
    </Box>
  );
};

export default AnimalAvailability;
