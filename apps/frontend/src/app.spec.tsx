import { render } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';

import { routes } from './app';
import { system } from './theme';

vi.mock('@api/apiClient', () => ({
  default: {
    getHello: vi.fn().mockResolvedValue('hello'),
    getAnimals: vi.fn().mockResolvedValue([]),
    getVolunteer: vi.fn().mockResolvedValue({
      volunteerId: 1,
      firstName: 'Matt',
      lastName: 'Wong',
    }),
  },
}));

const LOGO_ALT = 'MSPCA - Kindness and Care for Animals';

const renderAt = (path: string) =>
  render(
    <ChakraProvider value={system}>
      <RouterProvider
        router={createMemoryRouter(routes, { initialEntries: [path] })}
      />
    </ChakraProvider>,
  );

describe('App routes', () => {
  it('renders the navbar on the home page', () => {
    const view = renderAt('/');
    expect(view.getByAltText(LOGO_ALT)).toBeTruthy();
    expect(view.getByText('Welcome to scaffolding!')).toBeTruthy();
  });

  it('renders the navbar once on the animal availability page', () => {
    const view = renderAt('/animal-availability');
    expect(view.getAllByAltText(LOGO_ALT)).toHaveLength(1);
  });

  it('shows the navbar and a not-found message on an unknown route', () => {
    const view = renderAt('/does-not-exist');
    expect(view.getByAltText(LOGO_ALT)).toBeTruthy();
    expect(view.getByText('Page not found')).toBeTruthy();
  });
});
