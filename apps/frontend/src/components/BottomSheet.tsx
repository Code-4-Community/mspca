import { useRef, useState } from 'react';
import { Box, Flex } from '@chakra-ui/react';

// How much of the parent's height the sheet covers at each snap point:
// collapsed (just the handle peeks up), half, and expanded.
const SNAP_POINTS = [0.12, 0.5, 0.92];
// A drag shorter than this (in px) counts as a tap on the handle.
const TAP_THRESHOLD = 5;

interface BottomSheetProps {
  children: React.ReactNode;
}

/**
 * A sheet pinned to the bottom of its (relatively positioned) parent, used on
 * mobile to show content over a full-screen map.
 *
 * Drag the handle to resize it; on release it snaps to the closest of three
 * heights (collapsed, half, expanded). Tapping the handle moves to the next
 * height, wrapping back to collapsed. The content scrolls inside the sheet.
 */
const BottomSheet: React.FC<BottomSheetProps> = ({ children }) => {
  const sheetRef = useRef<HTMLDivElement>(null);
  const [snapIndex, setSnapIndex] = useState(1);
  const [dragStartY, setDragStartY] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragStartY(e.clientY);
    setDragOffset(0);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (dragStartY !== null) setDragOffset(dragStartY - e.clientY);
  };

  const handlePointerUp = () => {
    if (dragStartY === null) return;
    const parentHeight = sheetRef.current?.parentElement?.clientHeight ?? 0;

    if (Math.abs(dragOffset) < TAP_THRESHOLD || parentHeight === 0) {
      setSnapIndex((index) => (index + 1) % SNAP_POINTS.length);
    } else {
      const fraction = SNAP_POINTS[snapIndex] + dragOffset / parentHeight;
      const closest = SNAP_POINTS.reduce(
        (best, point, index) =>
          Math.abs(point - fraction) < Math.abs(SNAP_POINTS[best] - fraction)
            ? index
            : best,
        0,
      );
      setSnapIndex(closest);
    }

    setDragStartY(null);
    setDragOffset(0);
  };

  const dragging = dragStartY !== null;

  return (
    <Flex
      ref={sheetRef}
      position="absolute"
      left="0"
      right="0"
      bottom="0"
      // Above Leaflet's panes and controls, which go up to z-index 1000.
      zIndex="1100"
      direction="column"
      bg="bg.subtle"
      borderTopRadius="3xl"
      boxShadow="card"
      style={{
        height: `calc(${SNAP_POINTS[snapIndex] * 100}% + ${dragOffset}px)`,
        transition: dragging ? 'none' : 'height 0.25s ease',
      }}
    >
      <Flex
        as="button"
        aria-label="Resize animal list"
        justify="center"
        py="3"
        flex="none"
        cursor="grab"
        touchAction="none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <Box w="24" h="1.5" bg="gray.300" borderRadius="full" />
      </Flex>
      <Box flex="1" minH="0" overflowY="auto" px="4" pb="4">
        {children}
      </Box>
    </Flex>
  );
};

export default BottomSheet;
