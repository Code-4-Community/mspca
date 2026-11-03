import { useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  Flex,
  Image,
  Input,
  Portal,
  Text,
} from '@chakra-ui/react';

import apiClient, { type Animal } from '@api/apiClient';
import { formatAge } from '@utils/animals';
import { CalendarIcon, PLACEHOLDER_IMAGE } from './AnimalCard';
import RestrictionTag from './RestrictionTag';

// TODO: replace with the logged-in volunteer's ID once the frontend has access
// to the current user's profile.
const CURRENT_VOLUNTEER_ID = 1;

interface AnimalModalProps {
  animal: Animal | null;
  onClose: () => void;
}

// Form state lives in its own component so it resets whenever a different
// animal is opened.
const AnimalModalBody: React.FC<{ animal: Animal }> = ({ animal }) => {
  const [comments, setComments] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [requested, setRequested] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRequest = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await apiClient.createMatch({
        volunteerId: CURRENT_VOLUNTEER_ID,
        chameleonAnimalId: animal.chameleonAnimalId,
        additionalComments: comments.trim() || undefined,
      });
      setRequested(true);
    } catch {
      setError('Could not submit your request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog.Content
      w="704px"
      maxW="704px"
      h="825px"
      maxH="calc(100vh - 32px)"
      p="8"
      m="0"
      bg="white"
      borderRadius="3xl"
      boxShadow="card"
      display="flex"
      flexDirection="column"
      justifyContent="flex-start"
      alignItems="flex-start"
      gap="8"
      overflow="hidden"
    >
      <Flex
        alignSelf="stretch"
        flex="1"
        minH="0"
        direction="column"
        justify="flex-start"
        align="flex-start"
        gap="8"
      >
        <Flex
          alignSelf="stretch"
          direction="column"
          justify="flex-start"
          align="flex-start"
          gap="4"
        >
          <Flex
            alignSelf="stretch"
            justify="flex-start"
            align="flex-start"
            gap="4"
          >
            <Flex
              flex="1"
              direction="column"
              justify="flex-start"
              align="flex-start"
              gap="2"
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
                w="40"
                direction="column"
                justify="flex-start"
                align="flex-start"
              >
                <Flex
                  alignSelf="stretch"
                  direction="column"
                  justify="flex-start"
                  align="flex-start"
                >
                  <Dialog.Title
                    color="neutrals.black"
                    fontSize="30px"
                    fontWeight="bold"
                    lineHeight="40px"
                  >
                    {animal.name}
                  </Dialog.Title>
                  <Text
                    alignSelf="stretch"
                    color="neutrals.black85"
                    fontSize="14px"
                    fontWeight="medium"
                    lineHeight="20px"
                  >
                    {animal.breed.join(', ')}
                  </Text>
                </Flex>
                <Flex justify="flex-start" align="center" gap="1">
                  <CalendarIcon />
                  {/* TODO: Figma shows "5 Month Foster" (foster length), which
                      the schema doesn't have. Showing the animal's age. */}
                  <Text
                    color="neutrals.black"
                    fontSize="16px"
                    fontWeight="semibold"
                    lineHeight="24px"
                  >
                    {formatAge(animal.age)}
                  </Text>
                </Flex>
              </Flex>
            </Flex>
            <Flex
              w="72"
              direction="column"
              justify="flex-start"
              align="flex-start"
              gap="4"
            >
              {/* Space reserved for the map, which is out of scope for now. */}
              <Box alignSelf="stretch" h="72" aria-hidden="true" />
              <Text
                alignSelf="stretch"
                color="neutrals.black85"
                fontSize="14px"
                fontWeight="medium"
                lineHeight="20px"
              >
                {animal.location}
              </Text>
            </Flex>
          </Flex>
          {animal.restrictions && animal.restrictions.length > 0 && (
            <Flex
              alignSelf="stretch"
              wrap="wrap"
              justify="flex-start"
              align="flex-start"
              alignContent="flex-start"
              gap="2"
            >
              {animal.restrictions.map((label) => (
                <RestrictionTag key={label} label={label} />
              ))}
            </Flex>
          )}
        </Flex>

        <Flex
          alignSelf="stretch"
          flex="1"
          minH="0"
          justify="center"
          align="center"
          gap="2.5"
          overflowY="auto"
        >
          <Text
            flex="1"
            alignSelf="stretch"
            color="black"
            fontSize="16px"
            fontWeight="normal"
            lineHeight="24px"
            whiteSpace="pre-wrap"
          >
            {animal.fosterBioMemo}
            {animal.fosterBioMemo ? '\n' : ''}
            {`Weight: ${animal.weight} lbs`}
          </Text>
        </Flex>
      </Flex>

      <Flex alignSelf="stretch" direction="column" borderRadius="xl" gap="2">
        <Flex justify="flex-start" align="center" gap="4">
          {requested ? (
            <Text
              flex="1"
              textAlign="center"
              color="green.green2"
              fontSize="16px"
              fontWeight="semibold"
              lineHeight="24px"
            >
              Request submitted!
            </Text>
          ) : (
            <>
              <Input
                w="96"
                h="11"
                px="2.5"
                py="2"
                flex="none"
                placeholder="Additional Comments"
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                disabled={submitting}
                borderRadius="sm"
                borderWidth="0"
                outline="1px solid"
                outlineColor="border"
                outlineOffset="-1px"
                fontSize="14px"
                fontWeight="normal"
                lineHeight="20px"
                _placeholder={{ color: 'fg.subtle' }}
              />
              <Button
                flex="1"
                h="11"
                minW="11"
                px="5"
                py="0.5"
                gap="3"
                bg="neutral.solid"
                color="neutral.contrast"
                borderRadius="12px"
                overflow="hidden"
                fontSize="16px"
                fontWeight="semibold"
                lineHeight="24px"
                onClick={handleRequest}
                loading={submitting}
              >
                Apply
              </Button>
            </>
          )}
        </Flex>
        {error && <Text color="fg.error">{error}</Text>}
      </Flex>
    </Dialog.Content>
  );
};

const AnimalModal: React.FC<AnimalModalProps> = ({ animal, onClose }) => (
  <Dialog.Root
    open={animal !== null}
    onOpenChange={(e) => {
      if (!e.open) onClose();
    }}
    placement="center"
    scrollBehavior="inside"
    lazyMount
    unmountOnExit
  >
    <Portal>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        {animal && <AnimalModalBody key={animal.animalId} animal={animal} />}
      </Dialog.Positioner>
    </Portal>
  </Dialog.Root>
);

export default AnimalModal;
