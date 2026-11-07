export interface HomebaseLocation {
  name: string;
  address: string;
  // [latitude, longitude]
  position: [number, number];
}

// Where each homebase's pin goes on the map. Names match the homebase values an
// animal's location uses, so pins line up with the Location filter.
export const HOMEBASES: HomebaseLocation[] = [
  {
    name: 'Boston',
    address: '350 South Huntington Ave, Boston, MA 02130',
    position: [42.3229, -71.1111],
  },
  {
    name: 'Cape Cod',
    address: '1577 Falmouth Rd, Centerville, MA 02632',
    position: [41.6566, -70.3446],
  },
  {
    name: 'Salem',
    address: '347 Highland Ave, Salem, MA 01970',
    position: [42.4987, -70.9287],
  },
  {
    name: 'Nevins Farm',
    address: '400 Broadway, Methuen, MA 01844',
    position: [42.7338, -71.1946],
  },
];
