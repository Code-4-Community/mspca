import { useSearchParams } from 'react-router-dom';

import { parseVolunteerId } from './volunteer';

/**
 * The current volunteer's ID, read from the `?volunteerId=` query param.
 * TEMPORARY: replace with the signed-in volunteer once sign-in is implemented.
 */
export const useVolunteerId = (): number | null => {
  const [searchParams] = useSearchParams();
  return parseVolunteerId(searchParams.get('volunteerId'));
};
