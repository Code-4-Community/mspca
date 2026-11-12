import { useMemo } from 'react';
import { Box } from '@chakra-ui/react';
import L from 'leaflet';
import { MapContainer, Marker, TileLayer, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

import { Homebase } from '../types';
import { HOMEBASE_POSITIONS } from '@utils/homebases';
import pin from '../assets/map-pin.png';

const PIN_SIZE = 36;
const HIGHLIGHTED_PIN_SIZE = 48;

// The pin is a single black PNG, so a highlighted pin is drawn bigger with a
// glow in the theme's primary blue instead of a different colour.
const makePinIcon = (highlighted: boolean) => {
  const size = highlighted ? HIGHLIGHTED_PIN_SIZE : PIN_SIZE;
  const glow = highlighted ? 'filter: drop-shadow(0 0 6px #009cde);' : '';
  return L.divIcon({
    html: `<img src="${pin}" alt="" style="width: ${size}px; height: ${size}px; ${glow}" />`,
    className: '',
    iconSize: [size, size],
    // The tip of the pin sits on the homebase.
    iconAnchor: [size / 2, size],
  });
};

interface HomebaseMapProps {
  // Homebases picked with a pin or the Location filter.
  selected: Homebase[];
  // Homebase of the animal currently hovered in the list, if any.
  hovered: Homebase | null;
  onToggle: (homebase: Homebase) => void;
}

const HomebaseMap: React.FC<HomebaseMapProps> = ({
  selected,
  hovered,
  onToggle,
}) => {
  const icons = useMemo(
    () => ({ normal: makePinIcon(false), highlighted: makePinIcon(true) }),
    [],
  );

  return (
    <Box
      h="full"
      w="full"
      borderRadius="3xl"
      overflow="hidden"
      boxShadow="card"
    >
      <MapContainer
        bounds={Object.values(HOMEBASE_POSITIONS)}
        boundsOptions={{ padding: [40, 40] }}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {Object.values(Homebase).map((homebase) => {
          const highlighted =
            selected.includes(homebase) || hovered === homebase;
          return (
            <Marker
              key={homebase}
              position={HOMEBASE_POSITIONS[homebase]}
              icon={highlighted ? icons.highlighted : icons.normal}
              zIndexOffset={highlighted ? 1000 : 0}
              eventHandlers={{ click: () => onToggle(homebase) }}
            >
              <Tooltip direction="top" offset={[0, -PIN_SIZE]}>
                {homebase}
              </Tooltip>
            </Marker>
          );
        })}
      </MapContainer>
    </Box>
  );
};

export default HomebaseMap;
