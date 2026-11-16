import { Box, Button, Flex, Icon, Image, Text } from '@chakra-ui/react';
import { House } from 'lucide-react';

import type { Animal } from '../../types';
import { formatAge } from '@utils/animals';
import { PLACEHOLDER_IMAGE } from '../AnimalCard';

interface MatchTileProps {
  animal: Animal;
  onSeeMore: (animal: Animal) => void;
}

const SeeMoreButton: React.FC<{
  onClick: () => void;
  fontSize: string;
  lineHeight: string;
}> = ({ onClick, fontSize, lineHeight }) => (
  <Button
    alignSelf="stretch"
    h="9"
    minW="11"
    px="5"
    py="0.5"
    bg="blue.blue3"
    color="neutral.contrast"
    borderRadius="xl"
    fontSize={fontSize}
    fontWeight="semibold"
    lineHeight={lineHeight}
    onClick={onClick}
  >
    See More
  </Button>
);

// TODO: Figma shows the foster length ("5 Month Foster") or foster dates here,
// which the schema doesn't have yet. Showing the animal's age, like the
// animal modal does.
const AgeLine: React.FC<{ animal: Animal; fontSize: string }> = ({
  animal,
  fontSize,
}) => (
  <Flex align="center" gap="1">
    <Icon asChild boxSize="4" color="neutrals.black">
      <House strokeWidth={1} aria-hidden />
    </Icon>
    <Text color="neutrals.black" fontSize={fontSize} fontWeight="semibold">
      {formatAge(animal.ageYear, animal.ageMonth)}
    </Text>
  </Flex>
);

const NameAndBreed: React.FC<{ animal: Animal }> = ({ animal }) => (
  <Box minW="0">
    <Text
      color="neutrals.black"
      fontSize="18px"
      fontWeight="bold"
      lineHeight="28px"
      truncate
    >
      {animal.name}
    </Text>
    <Text
      color="neutrals.black85"
      fontSize="12px"
      fontWeight="medium"
      lineHeight="16px"
      truncate
    >
      {animal.breed.join(', ')}
    </Text>
  </Box>
);

/** Wide tile for a pending application, with a "Submitted" status badge. */
export const PendingMatchTile: React.FC<MatchTileProps> = ({
  animal,
  onSeeMore,
}) => (
  <Box
    position="relative"
    flexShrink={0}
    w="96"
    h="32"
    p="2"
    bg="gray.0"
    borderRadius="2xl"
    boxShadow="card"
  >
    <Flex
      position="absolute"
      top="2"
      right="2"
      h="5"
      px="3.5"
      align="center"
      bg="status.submitted"
      borderRadius="md"
      outline="1px solid"
      outlineColor="blue.blue3"
      outlineOffset="-1px"
    >
      <Text color="white" fontSize="10px" fontWeight="medium" lineHeight="16px">
        Submitted
      </Text>
    </Flex>
    <Flex h="full" align="center" gap="2">
      <Image
        src={PLACEHOLDER_IMAGE}
        alt={animal.name}
        flexShrink={0}
        boxSize="24"
        borderRadius="2xl"
        objectFit="cover"
      />
      <Flex
        flex="1"
        minW="0"
        h="full"
        direction="column"
        justify="space-between"
      >
        <Box pr="20">
          <NameAndBreed animal={animal} />
        </Box>
        <AgeLine animal={animal} fontSize="14px" />
        <SeeMoreButton
          onClick={() => onSeeMore(animal)}
          fontSize="14px"
          lineHeight="20px"
        />
      </Flex>
    </Flex>
  </Box>
);

/** Tall tile for a current or past foster. */
export const FosterMatchTile: React.FC<MatchTileProps> = ({
  animal,
  onSeeMore,
}) => (
  <Flex
    flexShrink={0}
    direction="column"
    gap="2"
    w="64"
    h="80"
    p="2"
    bg="gray.0"
    borderRadius="2xl"
    boxShadow="card"
  >
    <Image
      src={PLACEHOLDER_IMAGE}
      alt={animal.name}
      w="60"
      h="40"
      borderRadius="2xl"
      objectFit="cover"
    />
    <Box px="2">
      <NameAndBreed animal={animal} />
    </Box>
    <Box px="2">
      <AgeLine animal={animal} fontSize="16px" />
    </Box>
    <Box mt="auto" px="2">
      <SeeMoreButton
        onClick={() => onSeeMore(animal)}
        fontSize="16px"
        lineHeight="24px"
      />
    </Box>
  </Flex>
);
