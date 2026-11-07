import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
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

import apiClient, { type Animal } from '@api/apiClient';
import AnimalCard from '@components/AnimalCard';
import AnimalFilters from '@components/AnimalFilters';
import AnimalModal from '@components/AnimalModal';
import {
  EMPTY_FILTERS,
  getAnimalCity,
  matchesFilters,
  type AnimalFilterState,
} from '@utils/animals';
import { MOCK_RESTRICTIONS } from '@utils/mockRestrictions';
import logo from '../assets/mspca-logo.png';

const PageHeader: React.FC = () => (
  <Flex
    alignSelf="stretch"
    px="12"
    py="7"
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
        position="relative"
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
          position="absolute"
          left="7px"
          top="15px"
          textAlign="center"
          color="white"
          fontSize="2xl"
          fontWeight="semibold"
          lineHeight="36px"
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

const AnimalAvailability: React.FC = () => {
  // TODO: use the signed-in volunteer instead once sign-in is implemented.
  const volunteerId = Number(useParams().volunteerId);
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [activeFilters, setActiveFilters] =
    useState<AnimalFilterState>(EMPTY_FILTERS);
  const [selectedAnimal, setSelectedAnimal] = useState<Animal | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .getAnimals()
      .then((result) => {
        if (!cancelled)
          // TEMPORARY: attach mock restriction tags until the API returns them.
          setAnimals(
            result.map((animal) => ({
              ...animal,
              restrictions:
                animal.restrictions ??
                MOCK_RESTRICTIONS[animal.chameleonAnimalId],
            })),
          );
      })
      .catch(() => {
        if (!cancelled) setError('Something went wrong while loading animals.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const loadAnimals = () => {
    setLoading(true);
    setError(null);
    setReloadKey((key) => key + 1);
  };

  // Animals are fetched once; filters are applied here in real time.
  const visibleAnimals = useMemo(
    () => animals.filter((animal) => matchesFilters(animal, activeFilters)),
    [animals, activeFilters],
  );

  const locations = useMemo(
    () => [...new Set(animals.map(getAnimalCity))].sort(),
    [animals],
  );

  return (
    <Box bg="bg.subtle" minH="100vh">
      <PageHeader />
      <Flex gap="8" px="8" py="8" align="flex-start">
        <Flex direction="column" gap="4" flex="1" minW="0">
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
              <Button variant="outline" onClick={loadAnimals}>
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
        volunteerId={volunteerId}
        onClose={() => setSelectedAnimal(null)}
      />
    </Box>
  );
};

export default AnimalAvailability;
