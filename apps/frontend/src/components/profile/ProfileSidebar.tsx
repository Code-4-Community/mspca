import { Box, Flex, Text } from '@chakra-ui/react';

import type { Volunteer } from '../../types';
import type { ApiData } from '@utils/useApiData';
import { getAvatarColor, getInitials } from '@utils/volunteer';
import { ErrorState, LoadingState } from './FetchStates';

interface ProfileSidebarProps {
  volunteer: ApiData<Volunteer>;
}

/**
 * Blue left column of the Volunteer Profile: avatar, name, role, volunteer ID
 * and assigned coordinators. (Notifications are out of scope for now.)
 */
const ProfileSidebar: React.FC<ProfileSidebarProps> = ({ volunteer }) => {
  const { data, loading, error, notFound, reload } = volunteer;

  return (
    <Flex
      as="aside"
      direction="column"
      flexShrink={0}
      w="96"
      px="10"
      pt="7"
      pb="10"
      bg="blue.blue2"
      color="gray.0"
      borderLeftRadius="xl"
    >
      {loading ? (
        <LoadingState inverted />
      ) : notFound ? (
        <ErrorState
          message="We couldn't find a volunteer with this ID."
          inverted
        />
      ) : error || !data ? (
        <ErrorState
          message="Something went wrong while loading this profile."
          onRetry={reload}
          inverted
        />
      ) : (
        <>
          <Flex
            boxSize="24"
            align="center"
            justify="center"
            bg={getAvatarColor(data.volunteerId)}
            borderRadius="full"
            boxShadow="card"
            outline="3px solid"
            outlineColor="neutrals.black"
            outlineOffset="-3px"
            fontSize="36px"
            fontWeight="semibold"
            lineHeight="1"
          >
            {getInitials(data.firstName, data.lastName)}
          </Flex>
          <Text
            mt="3.5"
            fontSize="20px"
            fontWeight="semibold"
            lineHeight="32px"
          >
            {data.firstName} {data.lastName}
          </Text>
          <Text fontSize="16px" fontWeight="semibold" lineHeight="24px">
            Volunteer
          </Text>
          <Box mt="6" fontSize="16px" lineHeight="24px">
            <Text>Volunteer ID: {data.volunteerId}</Text>
            {data.assignedCoordinators.length === 0 ? (
              <Text>No coordinator assigned yet</Text>
            ) : (
              data.assignedCoordinators.map((coordinator) => (
                <Box key={coordinator.coordinatorId}>
                  <Text>
                    {coordinator.firstName} {coordinator.lastName}
                  </Text>
                  <Text wordBreak="break-all">{coordinator.email}</Text>
                </Box>
              ))
            )}
          </Box>
        </>
      )}
    </Flex>
  );
};

export default ProfileSidebar;
