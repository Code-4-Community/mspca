import { Homebase } from '../types';

// Where each homebase's pin goes on the map, as [latitude, longitude]. The
// addresses these come from are in HOMEBASE_ADDRESSES.
export const HOMEBASE_POSITIONS: Record<Homebase, [number, number]> = {
  [Homebase.BOSTON]: [42.3229, -71.1111],
  [Homebase.CAPE_COD]: [41.6566, -70.3446],
  [Homebase.SALEM]: [42.4987, -70.9287],
  [Homebase.NEVINS_FARM]: [42.7338, -71.1946],
};
