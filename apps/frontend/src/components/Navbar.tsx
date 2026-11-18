import { Button, Flex, Image, Text } from '@chakra-ui/react';

import { useCurrentUser } from '../auth/userContext';
import { getUserId } from '@utils/user';
import { getAvatarColor, getInitials } from '@utils/volunteer';
import logo from '../assets/mspca-logo.png';

/** Site-wide header: MSPCA logo and the signed-in user's profile button. */
const Navbar: React.FC = () => {
  const { currentUser } = useCurrentUser();

  return (
    <Flex
      as="header"
      px={{ base: '4', md: '8' }}
      py="4"
      minH={{ md: '120px' }}
      bg="gray.50"
      boxShadow="card"
      justify="space-between"
      align="center"
    >
      <Image
        src={logo}
        alt="MSPCA - Kindness and Care for Animals"
        w={{ base: '142px', md: '196px' }}
        h={{ base: '64px', md: '88px' }}
        objectFit="contain"
      />
      {/* TODO: link to the profile page once it exists. */}
      <Button
        type="button"
        aria-label="My Profile"
        variant="plain"
        display="flex"
        alignItems="center"
        gap="4"
        h="auto"
        cursor="pointer"
      >
        <Flex
          data-testid="navbar-avatar"
          boxSize={{ base: '50px', md: '66px' }}
          flexShrink={0}
          align="center"
          justify="center"
          bg={currentUser ? getAvatarColor(getUserId(currentUser)) : 'gray.300'}
          color="white"
          borderRadius="full"
          boxShadow="card"
          outline="3px solid"
          outlineColor="neutrals.black"
          outlineOffset="-3px"
          fontSize={{ base: '20px', md: '24px' }}
          fontWeight="semibold"
          lineHeight="1"
        >
          {currentUser
            ? getInitials(currentUser.user.firstName, currentUser.user.lastName)
            : ''}
        </Flex>
        <Text
          display={{ base: 'none', md: 'block' }}
          color="neutrals.black"
          fontSize="24px"
          fontWeight="semibold"
          lineHeight="36px"
        >
          My Profile
        </Text>
      </Button>
    </Flex>
  );
};

export default Navbar;
