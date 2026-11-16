import { useMemo, useState } from 'react';
import { Box, Flex } from '@chakra-ui/react';
import { useParams } from 'react-router-dom';

import apiClient from '@api/apiClient';
import FosterDashboard from '@components/profile/FosterDashboard';
import { ErrorState } from '@components/profile/FetchStates';
import ProfileInformation from '@components/profile/ProfileInformation';
import ProfileSidebar from '@components/profile/ProfileSidebar';
import ProfileTabs, { type ProfileTab } from '@components/profile/ProfileTabs';
import { useApiData } from '@utils/useApiData';
import { parseVolunteerId } from '@utils/volunteer';

/**
 * Foster volunteer's profile page (desktop): a sidebar with who they are and
 * a main panel with two tabs, the Foster Dashboard (their matches) and
 * Information & Settings (their editable profile).
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
    <Flex flex="1" px="6" py="8" bg="white" align="stretch">
      <ProfileSidebar volunteer={volunteer} />
      <Flex
        flex="1"
        minW="0"
        direction="column"
        align="center"
        gap="7"
        px="15"
        py="7"
        bg="gray.100"
        borderRightRadius="xl"
      >
        <ProfileTabs value={tab} onChange={setTab} />
        <Box
          w="full"
          maxW="858px"
          p="6"
          bg="gray.0"
          borderRadius="2xl"
          boxShadow="card"
        >
          {tab === 'dashboard' ? (
            <FosterDashboard matches={matches} animals={animals} />
          ) : (
            <ProfileInformation volunteer={volunteer} />
          )}
        </Box>
      </Flex>
    </Flex>
  );
};

export default VolunteerProfile;
