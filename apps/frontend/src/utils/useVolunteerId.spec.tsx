import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { useVolunteerId } from './useVolunteerId';

const Probe: React.FC = () => <span>{String(useVolunteerId())}</span>;

const renderAt = (route: string) =>
  render(
    <MemoryRouter initialEntries={[route]}>
      <Probe />
    </MemoryRouter>,
  );

describe('useVolunteerId', () => {
  it('reads volunteerId from the query string', () => {
    expect(renderAt('/x?volunteerId=7').getByText('7')).toBeTruthy();
  });

  it('returns null when volunteerId is missing', () => {
    expect(renderAt('/x').getByText('null')).toBeTruthy();
  });

  it('returns null when volunteerId is not a valid ID', () => {
    expect(renderAt('/x?volunteerId=abc').getByText('null')).toBeTruthy();
  });
});
