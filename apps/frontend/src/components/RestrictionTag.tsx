import { Flex, Text } from '@chakra-ui/react';

import { getRestriction } from '@utils/animals';

interface RestrictionTagProps {
  label: string;
}

const RestrictionTag: React.FC<RestrictionTagProps> = ({ label }) => {
  const restriction = getRestriction(label);
  if (!restriction) return null;

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
        <Text
          color="white"
          fontSize="12px"
          fontWeight="semibold"
          lineHeight="16px"
        >
          {label}
        </Text>
      </Flex>
    </Flex>
  );
};

export default RestrictionTag;
