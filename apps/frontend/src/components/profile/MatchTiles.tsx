import {
  Box,
  Button,
  Flex,
  Icon,
  Image,
  Text,
  type TextProps,
} from '@chakra-ui/react';
import { House } from 'lucide-react';

import type { Animal } from '../../types';
import { formatAge } from '@utils/animals';
import { PLACEHOLDER_IMAGE } from '../AnimalCard';

interface MatchTileProps {
  animal: Animal;
  onSeeMore: (animal: Animal) => void;
}

// Each tile passes its own mobile and desktop sizes.
type ResponsiveSize = TextProps['fontSize'];

const SeeMoreButton: React.FC<{
  onClick: () => void;
  fontSize: ResponsiveSize;
  lineHeight: ResponsiveSize;
  // Width on mobile; on desktop the button fills the tile's column.
  mobileW: string;
}> = ({ onClick, fontSize, lineHeight, mobileW }) => (
  <Button
    alignSelf={{ base: 'flex-start', lg: 'stretch' }}
    w={{ base: mobileW, lg: 'auto' }}
    h={{ base: '7', lg: '9' }}
    minW={{ base: '8', lg: '11' }}
    px={{ base: '3.5', lg: '5' }}
    py="0.5"
    bg="blue.blue3"
    color="neutral.contrast"
    borderRadius={{ base: 'lg', lg: 'xl' }}
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
const AgeLine: React.FC<{ animal: Animal; desktopFontSize: string }> = ({
  animal,
  desktopFontSize,
}) => (
  <Flex align="center" gap={{ base: '0.5', lg: '1' }}>
    <Icon asChild boxSize={{ base: '3.5', lg: '4' }} color="neutrals.black">
      <House strokeWidth={1} aria-hidden />
    </Icon>
    <Text
      color="neutrals.black"
      fontSize={{ base: '12px', lg: desktopFontSize }}
      lineHeight={{ base: '16px', lg: 'normal' }}
      fontWeight="semibold"
    >
      {formatAge(animal.ageYear, animal.ageMonth)}
    </Text>
  </Flex>
);

const NameAndBreed: React.FC<{ animal: Animal }> = ({ animal }) => (
  <Box minW="0">
    <Text
      color="neutrals.black"
      fontSize={{ base: '14px', lg: '18px' }}
      fontWeight="bold"
      lineHeight={{ base: '20px', lg: '28px' }}
      truncate
    >
      {animal.name}
    </Text>
    <Text
      color="neutrals.black85"
      fontSize={{ base: '9px', lg: '12px' }}
      fontWeight="medium"
      lineHeight={{ base: '12px', lg: '16px' }}
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
    w={{ base: '72', lg: '96' }}
    h={{ base: '24', lg: '32' }}
    p={{ base: '1.5', lg: '2' }}
    bg="gray.0"
    borderRadius={{ base: 'xl', lg: '2xl' }}
    boxShadow="card"
  >
    <Flex
      position="absolute"
      top={{ base: '1.5', lg: '2' }}
      right={{ base: '1.5', lg: '2' }}
      h={{ base: '3.5', lg: '5' }}
      px={{ base: '3', lg: '3.5' }}
      align="center"
      bg="status.submitted"
      borderRadius={{ base: 'sm', lg: 'md' }}
      outline={{ lg: '1px solid' }}
      outlineColor="blue.blue3"
      outlineOffset="-1px"
    >
      <Text
        color="white"
        fontSize={{ base: '7.5px', lg: '10px' }}
        fontWeight="medium"
        lineHeight={{ base: '12px', lg: '16px' }}
      >
        Submitted
      </Text>
    </Flex>
    <Flex h="full" align="center" gap={{ base: '1.5', lg: '2' }}>
      <Image
        src={PLACEHOLDER_IMAGE}
        alt={animal.name}
        flexShrink={0}
        w={{ base: '16', lg: '24' }}
        h={{ base: '20', lg: '24' }}
        borderRadius={{ base: 'xl', lg: '2xl' }}
        objectFit="cover"
      />
      <Flex
        flex="1"
        minW="0"
        h="full"
        direction="column"
        justify="space-between"
      >
        <Box pr={{ base: '16', lg: '20' }}>
          <NameAndBreed animal={animal} />
        </Box>
        <AgeLine animal={animal} desktopFontSize="14px" />
        <SeeMoreButton
          onClick={() => onSeeMore(animal)}
          fontSize={{ base: '9px', lg: '14px' }}
          lineHeight={{ base: '16px', lg: '20px' }}
          mobileW="32"
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
    w={{ base: '48', lg: '64' }}
    h={{ base: '60', lg: '80' }}
    p="2"
    bg="gray.0"
    borderRadius={{ base: 'xl', lg: '2xl' }}
    boxShadow="card"
  >
    <Image
      src={PLACEHOLDER_IMAGE}
      alt={animal.name}
      w={{ base: '44', lg: '60' }}
      h={{ base: '28', lg: '40' }}
      borderRadius={{ base: 'xl', lg: '2xl' }}
      objectFit="cover"
    />
    <Box px={{ base: '0', lg: '2' }}>
      <NameAndBreed animal={animal} />
    </Box>
    <Box px={{ base: '0', lg: '2' }}>
      <AgeLine animal={animal} desktopFontSize="16px" />
    </Box>
    <Box mt="auto" px={{ base: '0', lg: '2' }}>
      <SeeMoreButton
        onClick={() => onSeeMore(animal)}
        fontSize={{ base: '12px', lg: '16px' }}
        lineHeight={{ base: '16px', lg: '24px' }}
        mobileW="44"
      />
    </Box>
  </Flex>
);
