import { Flex, Text } from '@chakra-ui/react';

import { RESTRICTIONS } from '@utils/animals';
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
const RestrictionTag: React.FC<RestrictionTagProps> = ({ label }) => (
  <Flex
    h="5"
    px="2"
    bg={RESTRICTIONS[label].color}
    borderRadius="lg"
    align="center"
  >
    <Text color="gray.0" textStyle="xs" fontWeight="semibold">
      {label}
    </Text>
  </Flex>
);

export default RestrictionTag;
