import { render } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';

import { routes } from './app';
import { system } from './theme';

vi.mock('@api/apiClient', () => ({
  default: {
    getHello: vi.fn().mockResolvedValue('hello'),
    getVolunteer: vi.fn().mockResolvedValue({
      volunteerId: 1,
      firstName: 'Matt',
      lastName: 'Wong',
    }),
  },
}));

// A page that crashes while rendering.
vi.mock('@pages/AnimalAvailability', () => ({
  default: () => {
    throw new Error('page exploded');
  },
}));

describe('App routes when a page crashes', () => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  afterEach(() => {
    consoleError.mockRestore();
  });

  it('keeps the navbar above the error message', () => {
    // React logs the thrown render error; keep the test output clean.
    consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const view = render(
      <ChakraProvider value={system}>
        <RouterProvider
          router={createMemoryRouter(routes, {
            initialEntries: ['/animal-availability'],
          })}
        />
      </ChakraProvider>,
    );

    expect(view.getByText('page exploded')).toBeTruthy();
    expect(
      view.getByAltText('MSPCA - Kindness and Care for Animals'),
    ).toBeTruthy();
  });
});
