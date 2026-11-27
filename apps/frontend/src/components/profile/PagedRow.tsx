import { useState, type ReactNode } from 'react';
import {
  Box,
  Flex,
  Icon,
  IconButton,
  useBreakpointValue,
} from '@chakra-ui/react';
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
 * One row of tiles. On mobile it scrolls sideways, snapping to each tile; the
 * padding keeps the tiles' shadows from being clipped by the scroll area.
 */
export const TileRow: React.FC<{ children: ReactNode }> = ({ children }) => (
  <Flex
    alignSelf="stretch"
    gap={{ base: '3.5', lg: '5' }}
    align="center"
    overflowX={{ base: 'auto', lg: 'visible' }}
    scrollSnapType={{ base: 'x mandatory', lg: 'none' }}
    mx={{ base: '-1', lg: '0' }}
    p={{ base: '1', lg: '0' }}
    css={{ '& > *': { scrollSnapAlign: 'start', flexShrink: 0 } }}
  >
    {children}
  </Flex>
);

/**
 * A single row of tiles that shows `pageSize` at a time on desktop. When
 * there are more, a progress track and previous/next buttons appear under
 * the row. On mobile every tile is shown in a row that scrolls sideways
 * instead.
 */
const PagedRow = <T,>({
  items,
  pageSize,
  getKey,
  renderItem,
}: PagedRowProps<T>) => {
  const [page, setPage] = useState(0);
  // Read on the first render, so desktop doesn't flash the mobile row.
  const paged = useBreakpointValue({ base: false, lg: true }, { ssr: false });
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  // Keeps the page in range if the list shrinks.
  const current = Math.min(page, pageCount - 1);
  const visible = items.slice(current * pageSize, (current + 1) * pageSize);

  if (!paged) {
    return (
      <TileRow>
        {items.map((item) => (
          <Box key={getKey(item)}>{renderItem(item)}</Box>
        ))}
      </TileRow>
    );
  }

  return (
    <Flex direction="column" gap="6" alignSelf="stretch">
      <TileRow>
        {visible.map((item) => (
          <Box key={getKey(item)}>{renderItem(item)}</Box>
        ))}
      </TileRow>
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
