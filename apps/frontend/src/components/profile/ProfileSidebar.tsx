import { useState } from 'react';
import {
  Box,
  Button,
  Flex,
  Icon,
  IconButton,
  Text,
  type TextProps,
} from '@chakra-ui/react';
import { ChevronDown, ChevronUp } from 'lucide-react';

import type { Volunteer } from '../../types';
import type { ApiData } from '@utils/useApiData';
import { getAvatarColor, getInitials } from '@utils/volunteer';
import { ErrorState, LoadingState } from './FetchStates';

interface ProfileSidebarProps {
  volunteer: ApiData<Volunteer>;
}

// Set on each line, since Text doesn't inherit these from its parent.
const coordinatorTextProps: TextProps = {
  fontSize: { base: '10px', lg: '16px' },
  fontWeight: { base: 'medium', lg: 'normal' },
  lineHeight: { base: '16px', lg: '24px' },
};

interface Notification {
  headline: string;
  body: string;
  action: string;
}

// There's no notifications table yet, so notifications come from the
// volunteer's own record. Waiver signing isn't built yet, so its action
// button is shown disabled.

const getNotifications = (volunteer: Volunteer): Notification[] =>
  volunteer.mostRecentWaiverSigned
    ? []
    : [
        {
          headline: 'Sign Your Waiver',
          body: "You haven't signed the most recent foster waiver. Please sign it before taking in a foster animal.",
          action: 'Sign Waiver',
        },
      ];

const NotificationCard: React.FC<{ notification: Notification }> = ({
  notification,
}) => (
  <Flex
    direction="column"
    gap="5"
    w="full"
    h="full"
    pl="2.5"
    pr="7"
    py="3.5"
    bg="white"
    color="black"
    borderRadius="xl"
  >
    <Flex direction="column" gap="2">
      <Flex align="center" gap="1.5">
        <Text fontSize="16px" fontWeight="semibold" lineHeight="24px">
          {notification.headline}
        </Text>
        <Box flexShrink={0} boxSize="3" bg="error.100" borderRadius="full" />
      </Flex>
      <Text fontSize="14px" lineHeight="20px">
        {notification.body}
      </Text>
    </Flex>
    <Button
      alignSelf="flex-start"
      size="sm"
      h="7"
      px="3.5"
      bg="blue.blue3"
      color="fg.inverted"
      borderRadius="xl"
      fontSize="14px"
      fontWeight="semibold"
      lineHeight="20px"
      disabled
    >
      {notification.action}
    </Button>
  </Flex>
);

/**
 * Blue left column of the Volunteer Profile: avatar, name, role, volunteer ID,
 * assigned coordinators and the volunteer's notifications.
 */
const ProfileSidebar: React.FC<ProfileSidebarProps> = ({ volunteer }) => {
  const { data, loading, error, notFound, reload } = volunteer;

  return (
    <Flex
      as="aside"
      direction="column"
      flexShrink={0}
      w={{ base: 'full', lg: '96' }}
      minH={{ base: '32', lg: 'auto' }}
      px={{ base: '4', lg: '10' }}
      pt={{ base: '4', lg: '7' }}
      pb={{ base: '4', lg: '10' }}
      bg="blue.blue2"
      color="gray.0"
      borderLeftRadius={{ lg: 'xl' }}
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
          {/* On mobile the details sit beside the avatar, in a header band. */}
          <Flex
            direction={{ base: 'row', lg: 'column' }}
            align={{ base: 'flex-start', lg: 'stretch' }}
            gap={{ base: '6', lg: '3.5' }}
          >
            <Flex
              flexShrink={0}
              boxSize={{ base: '16', lg: '24' }}
              align="center"
              justify="center"
              bg={getAvatarColor(data.volunteerId)}
              borderRadius="full"
              boxShadow="card"
              outline={{ base: '2px solid', lg: '3px solid' }}
              outlineColor="neutrals.black"
              outlineOffset={{ base: '-2px', lg: '-3px' }}
              fontSize={{ base: '24px', lg: '36px' }}
              fontWeight="semibold"
              lineHeight="1"
            >
              {getInitials(data.firstName, data.lastName)}
            </Flex>
            <Box minW="0">
              <Text
                fontSize={{ base: '14px', lg: '20px' }}
                fontWeight="semibold"
                lineHeight={{ base: '24px', lg: '32px' }}
              >
                {data.firstName} {data.lastName}
              </Text>
              <Text
                fontSize={{ base: '12px', lg: '16px' }}
                lineHeight={{ base: '20px', lg: '24px' }}
              >
                <Text as="span" fontWeight={{ base: 'medium', lg: 'semibold' }}>
                  Volunteer ·{' '}
                </Text>
                ID {data.volunteerId}
              </Text>
              <Box mt={{ base: '1', lg: '2.5' }}>
                {data.assignedCoordinators.length === 0 ? (
                  <Text {...coordinatorTextProps}>
                    No coordinator assigned yet
                  </Text>
                ) : (
                  data.assignedCoordinators.map((coordinator) => (
                    <Box key={coordinator.coordinatorId}>
                      <Text {...coordinatorTextProps}>
                        {coordinator.firstName} {coordinator.lastName}
                      </Text>
                      <Text {...coordinatorTextProps} wordBreak="break-all">
                        {coordinator.email}
                      </Text>
                    </Box>
                  ))
                )}
              </Box>
            </Box>
          </Flex>
          {/* The mobile design has no notifications section. */}
          <NotificationsSection notifications={getNotifications(data)} />
        </>
      )}
    </Flex>
  );
};

const NotificationsSection: React.FC<{ notifications: Notification[] }> = ({
  notifications,
}) => (
  <Flex
    as="section"
    hideBelow="lg"
    direction="column"
    mt="9"
    aria-label="Notifications"
  >
    <Text fontSize="20px" fontWeight="semibold" lineHeight="32px">
      Notifications
    </Text>
    {/* Only one notification type exists, so sorting isn't wired up yet. */}
    <Button
      alignSelf="flex-start"
      variant="outline"
      w="40"
      h="7"
      px="2"
      justifyContent="space-between"
      bg="whiteAlpha.900"
      borderColor="gray.300"
      borderRadius="sm"
      color="fg.muted"
      fontSize="12px"
      fontWeight="normal"
      lineHeight="16px"
      disabled
      _disabled={{ opacity: 1, cursor: 'not-allowed' }}
    >
      Sort By: Deadline
      <Icon asChild boxSize="4" color="gray.600">
        <ChevronDown strokeWidth={2} aria-hidden />
      </Icon>
    </Button>
    {notifications.length === 0 ? (
      <Text mt="4" fontSize="14px" lineHeight="20px">
        You're all caught up.
      </Text>
    ) : (
      <NotificationStack notifications={notifications} />
    )}
  </Flex>
);

// How far each card behind the first one sticks out below it, and how dark
// it's tinted, when the stack is collapsed.
const PEEK_PX = 27;
const PEEK_TINTS = ['blue.blue3/20', 'blue.blue3/30'];

/**
 * Collapsed, shows the first notification with up to two more peeking out
 * below it, each tinted darker. The chevron underneath expands the stack
 * into a full list and collapses it again. The cards behind are only
 * decoration while collapsed, so they're hidden from screen readers and
 * can't be focused.
 */
const NotificationStack: React.FC<{ notifications: Notification[] }> = ({
  notifications,
}) => {
  const [expanded, setExpanded] = useState(false);
  const canExpand = notifications.length > 1;
  const stacked = notifications.slice(0, PEEK_TINTS.length + 1);

  return (
    <Flex mt="9" direction="column" align="center" gap="2.5">
      {expanded ? (
        <Flex id="notification-list" w="full" direction="column" gap="2.5">
          {notifications.map((notification) => (
            <NotificationCard
              key={notification.headline}
              notification={notification}
            />
          ))}
        </Flex>
      ) : (
        // Every card sits in the same grid cell, so they all stretch to the
        // tallest card's height and the ones behind only show below it.
        <Box
          id="notification-list"
          display="grid"
          w="full"
          pb={`${(stacked.length - 1) * PEEK_PX}px`}
        >
          {stacked.map((notification, i) => (
            <Box
              key={notification.headline}
              gridArea="1 / 1"
              position="relative"
              zIndex={stacked.length - i}
              transform={`translateY(${i * PEEK_PX}px)`}
              borderRadius="xl"
              overflow="hidden"
              // React 18 has no typing for `inert`, so it's passed as a string.
              {...(i > 0 && { 'aria-hidden': true, inert: '' })}
            >
              <NotificationCard notification={notification} />
              {i > 0 && (
                <Box position="absolute" inset="0" bg={PEEK_TINTS[i - 1]} />
              )}
            </Box>
          ))}
        </Box>
      )}
      {canExpand && (
        <IconButton
          aria-label={
            expanded ? 'Show fewer notifications' : 'Show all notifications'
          }
          aria-expanded={expanded}
          aria-controls="notification-list"
          variant="plain"
          size="sm"
          color="fg.inverted"
          _hover={{ bg: 'whiteAlpha.200' }}
          onClick={() => setExpanded((prev) => !prev)}
        >
          <Icon asChild boxSize="7">
            {expanded ? (
              <ChevronUp strokeWidth={2} aria-hidden />
            ) : (
              <ChevronDown strokeWidth={2} aria-hidden />
            )}
          </Icon>
        </IconButton>
      )}
    </Flex>
  );
};

export default ProfileSidebar;
