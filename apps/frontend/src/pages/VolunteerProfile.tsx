import { useMemo, useState } from 'react';
import { Box, Flex } from '@chakra-ui/react';
import { useParams } from 'react-router-dom';

import apiClient from '@api/apiClient';
import FosterDashboard from '@components/profile/FosterDashboard';
import { ErrorState } from '@components/profile/FetchStates';
import ProfileInformation from '@components/profile/ProfileInformation';
import ProfileSettings from '@components/profile/ProfileSettings';
import ProfileSidebar from '@components/profile/ProfileSidebar';
import ProfileTabs, { type ProfileTab } from '@components/profile/ProfileTabs';
import { useApiData } from '@utils/useApiData';
import { parseVolunteerId } from '@utils/volunteer';

// White card that holds each section of the main panel. On mobile it's
// smaller, and with `flatOnMobile` (the dashboard) the section sits straight
// on the white page instead.
const ProfileCard: React.FC<{
  flatOnMobile?: boolean;
  children: React.ReactNode;
}> = ({ flatOnMobile, children }) => (
  <Box
    w="full"
    maxW={{ lg: '858px' }}
    p={{ base: flatOnMobile ? '0' : '2.5', lg: '6' }}
    bg={{ base: flatOnMobile ? 'transparent' : 'gray.0', lg: 'gray.0' }}
    borderRadius={{ base: flatOnMobile ? 'none' : 'xl', lg: '2xl' }}
    boxShadow={{ base: flatOnMobile ? 'none' : 'card', lg: 'card' }}
  >
    {children}
  </Box>
);

/**
 * Foster volunteer's profile page: a sidebar with who they are and a main
 * panel with two tabs, the Foster Dashboard (their matches) and
 * Information & Settings (their editable profile and account settings).
 *
 * TEMPORARY: the volunteer comes from the `:volunteerId` route param until
 * sign-in is implemented.
 */
const VolunteerProfile: React.FC = () => {
  const volunteerId = parseVolunteerId(useParams().volunteerId ?? null);
  const [tab, setTab] = useState<ProfileTab>('dashboard');

  // No requests are made when the route ID isn't valid.
  const volunteer = useApiData(
    useMemo(
      () =>
        volunteerId === null ? null : () => apiClient.getVolunteer(volunteerId),
      [volunteerId],
    ),
  );
  const matches = useApiData(
    useMemo(
      () =>
        volunteerId === null
          ? null
          : () => apiClient.getVolunteerMatches(volunteerId),
      [volunteerId],
    ),
  );
  const animals = useApiData(
    useMemo(
      () => (volunteerId === null ? null : () => apiClient.getAnimals()),
      [volunteerId],
    ),
  );

  if (volunteerId === null) {
    return (
      <Box flex="1" px="6" py="8">
        <ErrorState message="This profile link isn't valid." />
      </Box>
    );
  }

  return (
    <Flex
      flex="1"
      direction={{ base: 'column', lg: 'row' }}
      px={{ lg: '6' }}
      py={{ lg: '8' }}
      bg="white"
      align="stretch"
    >
      <ProfileSidebar volunteer={volunteer} />
      <Flex
        flex="1"
        minW="0"
        direction="column"
        align="center"
        gap={{ base: '4', lg: '7' }}
        px={{ base: '4', lg: '15' }}
        py={{ base: '6', lg: '7' }}
        bg={{ lg: 'gray.100' }}
        borderRightRadius={{ lg: 'xl' }}
      >
        <ProfileTabs value={tab} onChange={setTab} />
        {tab === 'dashboard' ? (
          <ProfileCard flatOnMobile>
            <FosterDashboard matches={matches} animals={animals} />
          </ProfileCard>
        ) : (
          <Flex
            w="full"
            direction="column"
            align="center"
            gap={{ base: '6', lg: '11' }}
          >
            <ProfileCard>
              <ProfileInformation volunteer={volunteer} />
            </ProfileCard>
            <ProfileCard>
              <ProfileSettings volunteer={volunteer} />
            </ProfileCard>
          </Flex>
        )}
      </Flex>
    </Flex>
  );
};

export default VolunteerProfile;
