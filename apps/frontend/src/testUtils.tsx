import { render } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import { MemoryRouter } from 'react-router-dom';

import { system } from './theme';

/** Renders `ui` inside the app's Chakra theme and an in-memory router at `route`. */
export const renderWithProviders = (
  ui: React.ReactElement,
  { route = '/' }: { route?: string } = {},
) =>
  render(
    <ChakraProvider value={system}>
      <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
    </ChakraProvider>,
  );
