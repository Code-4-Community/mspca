// TEMPORARY: the animals API doesn't return restriction tags yet, so these are
// mock tags keyed by chameleonAnimalId to exercise the filters, pills and modal.
// Delete this file (and its use in AnimalAvailability.tsx) once the API returns
// `restrictions`.
export const MOCK_RESTRICTIONS: Record<number, string[]> = {
  1001: ['No Restrictions'],
  1002: ['Child-Free Home'],
  1003: ['Requires Medication'],
  1004: ['Pet-Free Home'],
  1005: ['Dog-Free Home', 'Activity Restriction'],
  1006: ['Cat-Free Home'],
  1007: ['Child-Free Home', 'Requires Medication'],
  1008: ['Cat-Free Home'],
  1009: ['Dog-Free Home', 'Cat-Free Home'],
  1010: ['No Restrictions'],
};
