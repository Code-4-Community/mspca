import { useState, type ReactNode } from 'react';
import { Box, Flex, Icon, IconButton } from '@chakra-ui/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PagedRowProps<T> {
  items: T[];
  pageSize: number;
  getKey: (item: T) => string | number;
  renderItem: (item: T) => ReactNode;
}

const PageButton: React.FC<{
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}> = ({ label, disabled, onClick, children }) => (
  <IconButton
    aria-label={label}
    variant="outline"
    w="24"
    h="7"
    minW="11"
    borderRadius="xl"
    borderWidth="2px"
    borderColor="gray.300"
    color="fg"
    disabled={disabled}
    onClick={onClick}
  >
    <Icon asChild boxSize="5">
      {children}
    </Icon>
  </IconButton>
);

/**
 * A single row of tiles that shows `pageSize` at a time. When there are more,
 * a progress track and previous/next buttons appear under the row.
 */
const PagedRow = <T,>({
  items,
  pageSize,
  getKey,
  renderItem,
}: PagedRowProps<T>) => {
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  // Keeps the page in range if the list shrinks.
  const current = Math.min(page, pageCount - 1);
  const visible = items.slice(current * pageSize, (current + 1) * pageSize);

  return (
    <Flex direction="column" gap="6" alignSelf="stretch">
      <Flex gap="5" align="center">
        {visible.map((item) => (
          <Box key={getKey(item)}>{renderItem(item)}</Box>
        ))}
      </Flex>
      {pageCount > 1 && (
        <Flex align="center" gap="9">
          <Box
            position="relative"
            w="96"
            h="2"
            bg="gray.200"
            borderRadius="5px"
            aria-hidden
          >
            <Box
              position="absolute"
              top="0"
              h="full"
              w={`${100 / pageCount}%`}
              left={`${(100 / pageCount) * current}%`}
              bg="gray.400"
              borderRadius="5px"
            />
          </Box>
          <Flex align="center" gap="3">
            <PageButton
              label="Previous"
              disabled={current === 0}
              onClick={() => setPage(current - 1)}
            >
              <ChevronLeft strokeWidth={2} aria-hidden />
            </PageButton>
            <PageButton
              label="Next"
              disabled={current === pageCount - 1}
              onClick={() => setPage(current + 1)}
            >
              <ChevronRight strokeWidth={2} aria-hidden />
            </PageButton>
          </Flex>
        </Flex>
      )}
    </Flex>
  );
};

export default PagedRow;
