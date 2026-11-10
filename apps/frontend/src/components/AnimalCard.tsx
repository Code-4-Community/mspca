import { Box, Button, Flex, Icon, Image, Text } from '@chakra-ui/react';

import type { Animal } from '@api/apiClient';
import { formatAge } from '@utils/animals';
import RestrictionTag from './RestrictionTag';
import catImage from '../assets/cat.png';

// TODO: swap for animal.picture once animal images are supported.
export const PLACEHOLDER_IMAGE = catImage;

export const CalendarIcon: React.FC = () => (
  <Icon asChild boxSize="5" color="neutrals.black">
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M13.333 1.667v3.333M6.667 1.667v3.333M16.25 3.333H3.75c-.69 0-1.25.56-1.25 1.25v12.083c0 .69.56 1.25 1.25 1.25h12.5c.69 0 1.25-.56 1.25-1.25V4.583c0-.69-.56-1.25-1.25-1.25zM2.5 8.333h15" />
    </svg>
  </Icon>
);

interface AnimalCardProps {
  animal: Animal;
  onSeeMore: (animal: Animal) => void;
  onHoverChange: (hovering: boolean) => void;
}

const AnimalCard: React.FC<AnimalCardProps> = ({
  animal,
  onSeeMore,
  onHoverChange,
}) => (
  <Flex
    onMouseEnter={() => onHoverChange(true)}
    onMouseLeave={() => onHoverChange(false)}
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
        <Box alignSelf="stretch">
          <Flex alignSelf="stretch" align="center" gap="1">
            <CalendarIcon />
            <Text
              color="neutrals.black"
              fontSize="16px"
              fontWeight="semibold"
              lineHeight="24px"
            >
              {formatAge(animal.age)}
            </Text>
          </Flex>
          <Text
            color="neutrals.black85"
            fontSize="14px"
            fontWeight="medium"
            lineHeight="20px"
          >
            {animal.location}
          </Text>
        </Box>
      </Flex>
      <Button
        alignSelf="stretch"
        h="11"
        minW="11"
        px="5"
        py="0.5"
        gap="3"
        bg="neutrals.black"
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
