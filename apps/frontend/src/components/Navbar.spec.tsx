import { fireEvent, waitFor } from '@testing-library/react';
import { useNavigate } from 'react-router-dom';
import type { Mock } from 'vitest';

import apiClient, { type Volunteer } from '@api/apiClient';
import { renderWithProviders } from '../testUtils';
import Navbar from './Navbar';

vi.mock('@api/apiClient', () => ({
  default: { getVolunteer: vi.fn() },
}));

const getVolunteer = apiClient.getVolunteer as Mock;

const volunteer = (
  volunteerId: number,
  firstName: string,
  lastName: string,
): Volunteer => ({ volunteerId, firstName, lastName });

const GoTo: React.FC<{ to: string }> = ({ to }) => {
  const navigate = useNavigate();
  return <button onClick={() => navigate(to)}>go</button>;
};

const avatarText = (container: ReturnType<typeof renderWithProviders>) =>
  container.getByTestId('navbar-avatar').textContent;

describe('Navbar', () => {
  beforeEach(() => {
    getVolunteer.mockReset();
  });

  it('renders the MSPCA logo', () => {
    const view = renderWithProviders(<Navbar />);
    expect(
      view.getByAltText('MSPCA - Kindness and Care for Animals'),
    ).toBeTruthy();
  });

  it('shows the profile button', () => {
    const view = renderWithProviders(<Navbar />);
    expect(view.getByRole('button', { name: 'My Profile' })).toBeTruthy();
  });

  it("shows the volunteer's initials", async () => {
    getVolunteer.mockResolvedValue(volunteer(3, 'Matt', 'Wong'));
    const view = renderWithProviders(<Navbar />, { route: '/?volunteerId=3' });

    expect(await view.findByText('MW')).toBeTruthy();
    expect(getVolunteer).toHaveBeenCalledTimes(1);
    expect(getVolunteer).toHaveBeenCalledWith(3);
  });

  it('shows a fallback avatar and makes no request without a volunteerId', () => {
    const view = renderWithProviders(<Navbar />);

    expect(avatarText(view)).toBe('');
    expect(getVolunteer).not.toHaveBeenCalled();
  });

  it('shows a fallback avatar and warns when the volunteer request fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    getVolunteer.mockRejectedValue(new Error('404'));
    const view = renderWithProviders(<Navbar />, { route: '/?volunteerId=9' });

    // Waiting for the warning means the rejection has been handled.
    await waitFor(() => expect(warn).toHaveBeenCalledTimes(1));
    expect(avatarText(view)).toBe('');
    warn.mockRestore();
  });

  it('ignores a stale response after the volunteerId changes', async () => {
    let resolveFirst: (v: Volunteer) => void = () => undefined;
    getVolunteer
      .mockReturnValueOnce(
        new Promise<Volunteer>((resolve) => {
          resolveFirst = resolve;
        }),
      )
      .mockResolvedValueOnce(volunteer(2, 'Anna', 'Lee'));

    const view = renderWithProviders(
      <>
        <Navbar />
        <GoTo to="/?volunteerId=2" />
      </>,
      { route: '/?volunteerId=1' },
    );

    fireEvent.click(view.getByText('go'));
    expect(await view.findByText('AL')).toBeTruthy();

    resolveFirst(volunteer(1, 'Matt', 'Wong'));
    await new Promise((r) => setTimeout(r, 0));

    expect(avatarText(view)).toBe('AL');
  });
});
