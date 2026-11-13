import { useState } from 'react';
import {
  Button,
  Dialog,
  Flex,
  Icon,
  Image,
  Portal,
  Text,
  Textarea,
} from '@chakra-ui/react';
import { ExternalLink, House } from 'lucide-react';

import apiClient from '@api/apiClient';
import type { Animal } from '../../types';
import { HOMEBASE_ADDRESSES, formatAge } from '@utils/animals';
import { useVolunteerId } from '@utils/useVolunteerId';
import { PLACEHOLDER_IMAGE } from '../AnimalCard';
import RestrictionTag from '../RestrictionTag';

interface AnimalModalProps {
  animal: Animal | null;
  onClose: () => void;
}

/**
 * Detail modal for one animal, opened from the "See More" button on an
 * `AnimalCard`.
 *
 * Shows the animal's photo, the address of its homebase, name, breed, age,
 * restriction tags and foster bio. At the bottom the volunteer can type
 * optional comments and press Apply to submit a match request for the animal
 * (`apiClient.createMatch`); the form then shows a confirmation, and Back
 * closes the modal. Pass `animal={null}` to keep it closed. The form resets
 * whenever a different animal is opened.
 */
const AnimalModal: React.FC<AnimalModalProps> = ({ animal, onClose }) => {
  const [comments, setComments] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [requested, setRequested] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // TEMPORARY: comes from the URL until sign-in is implemented.
  const volunteerId = useVolunteerId();

  // Reset the form when a different animal is opened.
  const [formAnimalId, setFormAnimalId] = useState(animal?.animalId);
  if (animal?.animalId !== formAnimalId) {
    setFormAnimalId(animal?.animalId);
    setComments('');
    setSubmitting(false);
    setRequested(false);
    setError(null);
  }

  const handleRequest = async () => {
    if (!animal || volunteerId === null) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiClient.createMatch({
        volunteerId,
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
          {animal && (
            <Dialog.Content
              w="762px"
              maxW="762px"
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
              gap="4"
              overflow="hidden"
            >
              <Flex
                alignSelf="stretch"
                flex="1"
                minH="0"
                direction="column"
                justify="flex-start"
                align="flex-start"
                gap="2"
              >
                <Flex
                  alignSelf="stretch"
                  justify="flex-start"
                  align="flex-start"
                  gap="4"
                >
                  <Image
                    flex="1"
                    src={PLACEHOLDER_IMAGE}
                    alt={animal.name}
                    position="relative"
                    h="72"
                    minW="0"
                    borderRadius="2xl"
                    objectFit="cover"
                  />
                  {/* Space reserved for the map, which is out of scope for now. */}
                  <Flex
                    flex="none"
                    boxSize="72"
                    direction="column"
                    justify="flex-end"
                    align="flex-start"
                    gap="2.5"
                    borderRadius="2xl"
                    overflow="hidden"
                  >
                    <Flex
                      alignSelf="stretch"
                      px="3"
                      py="2"
                      bg="rgba(41, 37, 36, 0.75)"
                      justify="space-between"
                      align="center"
                    >
                      <Text
                        color="gray.0"
                        fontSize="14px"
                        fontWeight="semibold"
                        lineHeight="20px"
                      >
                        {HOMEBASE_ADDRESSES[animal.location]}
                      </Text>
                      <Icon asChild boxSize="5" color="gray.0">
                        <ExternalLink strokeWidth={1} aria-hidden />
                      </Icon>
                    </Flex>
                  </Flex>
                </Flex>

                <Flex
                  alignSelf="stretch"
                  flex="1"
                  minH="0"
                  direction="column"
                  justify="flex-start"
                  align="flex-start"
                  gap="4"
                  overflowY="auto"
                >
                  <Flex
                    alignSelf="stretch"
                    direction="column"
                    justify="flex-start"
                    align="flex-start"
                    gap="2"
                  >
                    <Flex
                      alignSelf="stretch"
                      direction="column"
                      justify="flex-start"
                      align="flex-start"
                      gap="1"
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
                          textStyle="body-small"
                          fontWeight="medium"
                        >
                          {animal.breed.join(', ')}
                        </Text>
                      </Flex>
                      <Flex justify="flex-start" align="center" gap="1">
                        <Icon asChild boxSize="5" color="neutrals.black">
                          <House strokeWidth={1} aria-hidden />
                        </Icon>
                        {/* TODO: Figma shows "5 Month Foster" (foster length), which
                    the schema doesn't have. Showing the animal's age. */}
                        <Text color="neutrals.black" textStyle="h7">
                          {formatAge(animal.ageYear)}
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
                  <Text
                    alignSelf="stretch"
                    color="black"
                    fontSize="16px"
                    fontWeight="normal"
                    lineHeight="24px"
                    whiteSpace="pre-wrap"
                  >
                    {animal.fosterBioMemo}
                  </Text>
                </Flex>
              </Flex>

              <Flex alignSelf="stretch" direction="column" gap="4">
                {requested ? (
                  <Text
                    textAlign="center"
                    color="green.green2"
                    fontSize="16px"
                    fontWeight="semibold"
                    lineHeight="24px"
                  >
                    Request submitted!
                  </Text>
                ) : (
                  <Textarea
                    alignSelf="stretch"
                    h="11"
                    minH="11"
                    px="2.5"
                    py="2"
                    placeholder="Additional Comments"
                    value={comments}
                    onChange={(e) => setComments(e.target.value)}
                    disabled={submitting}
                    borderRadius="sm"
                    borderWidth="0"
                    outline="1px solid"
                    outlineColor="border.emphasized"
                    outlineOffset="-1px"
                    fontSize="14px"
                    fontWeight="normal"
                    lineHeight="20px"
                    resize="vertical"
                    _placeholder={{ color: 'fg.muted' }}
                  />
                )}
                {error && <Text color="fg.error">{error}</Text>}
                <Flex
                  alignSelf="stretch"
                  justify="flex-start"
                  align="flex-start"
                  gap="4"
                >
                  <Button
                    variant="outline"
                    flex="1"
                    h="11"
                    minW="11"
                    px="5"
                    py="0.5"
                    gap="3"
                    border="none"
                    borderRadius="12px"
                    outline="1px solid"
                    outlineColor="neutral.muted"
                    outlineOffset="-1px"
                    overflow="hidden"
                    color="neutral.fg"
                    fontSize="16px"
                    fontWeight="semibold"
                    lineHeight="24px"
                    onClick={onClose}
                  >
                    Back
                  </Button>
                  {!requested && (
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
                      disabled={volunteerId === null}
                    >
                      Apply
                    </Button>
                  )}
                </Flex>
              </Flex>
            </Dialog.Content>
          )}
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
};

export default AnimalModal;
