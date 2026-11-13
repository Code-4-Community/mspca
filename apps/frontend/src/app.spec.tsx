import { render } from '@testing-library/react';

import App from './app';

vi.mock('@api/apiClient', () => ({
  default: { getHello: vi.fn().mockResolvedValue('hello') },
}));

describe('App', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<App />);
    expect(baseElement).toBeTruthy();
  });
});
