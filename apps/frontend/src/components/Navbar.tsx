import { useEffect, useState } from 'react';
import { chakra, Flex, Image, Text } from '@chakra-ui/react';

import apiClient, { type Volunteer } from '@api/apiClient';
import { useVolunteerId } from '@utils/useVolunteerId';
import { getAvatarColor, getInitials } from '@utils/volunteer';
import logo from '../assets/mspca-logo.png';

const VolunteerAvatar: React.FC<{ volunteer: Volunteer | null }> = ({
  volunteer,
}) => (
  <Flex
    data-testid="navbar-avatar"
    boxSize={{ base: '50px', md: '66px' }}
    flexShrink={0}
    align="center"
    justify="center"
    bg={volunteer ? getAvatarColor(volunteer.volunteerId) : 'gray.300'}
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
    {volunteer ? getInitials(volunteer.firstName, volunteer.lastName) : ''}
  </Flex>
);

/** Site-wide header: MSPCA logo and the current volunteer's profile button. */
const Navbar: React.FC = () => {
  const volunteerId = useVolunteerId();
  const [loaded, setLoaded] = useState<Volunteer | null>(null);
  // Only show a volunteer that matches the current URL, so a previous
  // volunteer never lingers while the next one loads.
  const volunteer = loaded?.volunteerId === volunteerId ? loaded : null;

  useEffect(() => {
    if (volunteerId === null) return;

    let cancelled = false;
    apiClient
      .getVolunteer(volunteerId)
      .then((result) => {
        if (!cancelled) setLoaded(result);
      })
      .catch((err: unknown) => {
        // Unknown volunteer or network error: keep the fallback avatar.
        console.warn(`Could not load volunteer ${volunteerId}`, err);
      });
    return () => {
      cancelled = true;
    };
  }, [volunteerId]);

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
      {/* TODO: link to the volunteer profile page once it exists. */}
      <chakra.button
        type="button"
        aria-label="My Profile"
        className="group"
        display="flex"
        alignItems="center"
        gap="4"
        cursor="pointer"
      >
        <VolunteerAvatar volunteer={volunteer} />
        <Text
          display={{ base: 'none', md: 'block' }}
          color="neutrals.black"
          fontSize="24px"
          fontWeight="semibold"
          lineHeight="36px"
          _groupHover={{ textDecoration: 'underline' }}
        >
          My Profile
        </Text>
      </chakra.button>
    </Flex>
  );
};

export default Navbar;
