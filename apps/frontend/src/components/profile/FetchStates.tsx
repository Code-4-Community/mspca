import { Button, Flex, Spinner, Text } from '@chakra-ui/react';

// Shared loading and error views for the Volunteer Profile's data fetches.
// `inverted` is for the dark blue sidebar.

export const LoadingState: React.FC<{ inverted?: boolean }> = ({
  inverted,
}) => (
  <Flex justify="center" alignSelf="stretch" py="10">
    <Spinner size="lg" color={inverted ? 'gray.0' : 'blue.primary'} />
  </Flex>
);

export const ErrorState: React.FC<{
  message: string;
  onRetry?: () => void;
  inverted?: boolean;
}> = ({ message, onRetry, inverted }) => (
  <Flex
    direction="column"
    align="center"
    alignSelf="stretch"
    gap="4"
    py="10"
    textAlign="center"
  >
    <Text color={inverted ? 'gray.0' : 'fg.error'}>{message}</Text>
    {onRetry && (
      <Button
        variant="outline"
        color={inverted ? 'gray.0' : undefined}
        borderColor={inverted ? 'gray.0' : undefined}
        _hover={inverted ? { bg: 'whiteAlpha.200' } : undefined}
        onClick={onRetry}
      >
        Try again
      </Button>
    )}
  </Flex>
);
