import { fireEvent, waitFor } from '@testing-library/react';
import type { Mock } from 'vitest';

import apiClient, { type Animal } from '@api/apiClient';
import { renderWithProviders } from '../testUtils';
import AnimalModal from './AnimalModal';

vi.mock('@api/apiClient', () => ({
  default: { createMatch: vi.fn() },
}));

const createMatch = apiClient.createMatch as Mock;

const animal = {
  animalId: 1,
  chameleonAnimalId: 555,
  name: 'Biscuit',
  age: 2,
  sex: 'Male',
  breed: ['Beagle'],
  weight: 20,
  location: 'Boston, MA',
  picture: null,
  fosterBioMemo: null,
} as Animal;

const renderModal = (route: string) =>
  renderWithProviders(<AnimalModal animal={animal} onClose={vi.fn()} />, {
    route,
  });

describe('AnimalModal', () => {
  beforeEach(() => {
    createMatch.mockReset();
    createMatch.mockResolvedValue({});
  });

  it('requests a match for the volunteer in the URL', async () => {
    const view = renderModal('/?volunteerId=5');

    fireEvent.click(await view.findByRole('button', { name: 'Apply' }));

    await waitFor(() => expect(createMatch).toHaveBeenCalledTimes(1));
    expect(createMatch).toHaveBeenCalledWith({
      volunteerId: 5,
      chameleonAnimalId: 555,
      additionalComments: undefined,
    });
  });

  it('disables the request without a volunteerId in the URL', async () => {
    const view = renderModal('/');

    const apply = (await view.findByRole('button', {
      name: 'Apply',
    })) as HTMLButtonElement;
    fireEvent.click(apply);

    expect(apply.disabled).toBe(true);
    expect(createMatch).not.toHaveBeenCalled();
  });
});
