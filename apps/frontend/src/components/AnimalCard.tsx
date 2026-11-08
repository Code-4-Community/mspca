import { Box, Button, Flex, Icon, Image, Text } from '@chakra-ui/react';
import { House } from 'lucide-react';

import type { Animal } from '../types';
import { formatAge } from '@utils/animals';
import RestrictionTag from './RestrictionTag';
import catImage from '../assets/cat.png';

// TODO: swap for animal.picture once animal images are supported.
export const PLACEHOLDER_IMAGE = catImage;

interface AnimalCardProps {
  animal: Animal;
  onSeeMore: (animal: Animal) => void;
}

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
              fontSize="14px"
              fontWeight="medium"
              lineHeight="20px"
            >
              {animal.breed.join(', ')}
            </Text>
          </Box>
          <Flex alignSelf="stretch" align="center" gap="1">
            <Icon asChild boxSize="5" color="neutrals.black">
              <House strokeWidth={1} aria-hidden />
            </Icon>
            <Text
              color="neutrals.black"
              fontSize="16px"
              fontWeight="semibold"
              lineHeight="24px"
            >
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
          fontSize="14px"
          fontWeight="medium"
          lineHeight="20px"
        >
          {animal.location}
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
