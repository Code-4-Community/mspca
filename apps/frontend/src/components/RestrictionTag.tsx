import { Flex, Text } from '@chakra-ui/react';

import { getRestriction } from '@utils/animals';
import type { Restriction } from '../types';

interface RestrictionTagProps {
  label: Restriction;
}

/**
 * A small colored pill showing one animal restriction, e.g. "Dog-Free Home".
 *
 * The background color comes from the restriction's theme token (see
 * `RESTRICTIONS` in `utils/animals.ts`), so each restriction always renders in
 * the same color on the animal card, the modal and anywhere else it appears.
 */
const RestrictionTag: React.FC<RestrictionTagProps> = ({ label }) => {
  const restriction = getRestriction(label);

  return (
    <Flex justify="flex-start" align="flex-start">
      <Flex
        h="5"
        minH="4"
        px="2"
        py="2.5"
        gap="1"
        bg={restriction.color}
        borderRadius="lg"
        justify="center"
        align="center"
      >
        <Text color="white" textStyle="xs" fontWeight="semibold">
          {label}
        </Text>
      </Flex>
    </Flex>
  );
};

export default RestrictionTag;
