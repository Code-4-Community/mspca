import { Box, Button, Flex, Icon, Image, Text } from '@chakra-ui/react';
import { House } from 'lucide-react';

import type { Animal } from '../types';
import { HOMEBASE_ADDRESSES, formatAge } from '@utils/animals';
import RestrictionTag from './RestrictionTag';
import catImage from '../assets/cat.png';

// TODO: swap for animal.picture once animal images are supported.
export const PLACEHOLDER_IMAGE = catImage;

interface AnimalCardProps {
  animal: Animal;
  onSeeMore: (animal: Animal) => void;
}

/**
 * A summary card for one adoptable animal, shown in the grid on the Animal
 * Availability page.
 *
 * Shows the animal's photo, name, breed, age, restriction tags and the address
 * of the homebase it's at, with a "See More" button that calls `onSeeMore` so
 * the page can open the animal's detail modal. The card holds no state of its
 * own: everything it displays comes from the `animal` prop.
 */
const AnimalCard: React.FC<AnimalCardProps> = ({ animal, onSeeMore }) => (
  <Flex
    alignSelf="stretch"
    direction="column"
    justify="flex-end"
    align="flex-start"
    gap="4"
    p="4"
    bg="white"
    borderRadius="3xl"
    boxShadow="card"
  >
    <Image
      alignSelf="stretch"
      src={PLACEHOLDER_IMAGE}
      alt={animal.name}
      position="relative"
      h="72"
      borderRadius="2xl"
      objectFit="cover"
    />
    <Flex
      alignSelf="stretch"
      direction="column"
      justify="space-between"
      align="flex-start"
      h="60"
    >
      <Flex alignSelf="stretch" direction="column" align="flex-start" gap="2">
        <Flex alignSelf="stretch" direction="column" align="flex-start" gap="2">
          <Box alignSelf="stretch">
            <Text
              color="neutrals.black"
              fontSize="30px"
              fontWeight="bold"
              lineHeight="40px"
            >
              {animal.name}
            </Text>
            <Text
              color="neutrals.black85"
              textStyle="body-small"
              fontWeight="medium"
            >
              {animal.breed.join(', ')}
            </Text>
          </Box>
          <Flex alignSelf="stretch" align="center" gap="1">
            <Icon asChild boxSize="5" color="neutrals.black">
              <House strokeWidth={1} aria-hidden />
            </Icon>
            <Text color="neutrals.black" textStyle="h7">
              {formatAge(animal.ageYear)}
            </Text>
          </Flex>
          {animal.restrictions && animal.restrictions.length > 0 && (
            <Flex
              alignSelf="stretch"
              wrap="wrap"
              align="flex-start"
              alignContent="flex-start"
              justify="flex-start"
              gap="2"
            >
              {animal.restrictions.map((label) => (
                <RestrictionTag key={label} label={label} />
              ))}
            </Flex>
          )}
        </Flex>
        <Text
          color="neutrals.black85"
          textStyle="body-small"
          fontWeight="medium"
        >
          {HOMEBASE_ADDRESSES[animal.location]}
        </Text>
      </Flex>
      <Button
        alignSelf="stretch"
        h="11"
        minW="11"
        px="5"
        py="0.5"
        gap="3"
        bg="blue.blue3"
        color="white"
        borderRadius="12px"
        overflow="hidden"
        fontSize="16px"
        fontWeight="semibold"
        lineHeight="24px"
        onClick={() => onSeeMore(animal)}
      >
        See More
      </Button>
    </Flex>
  </Flex>
);

export default AnimalCard;
