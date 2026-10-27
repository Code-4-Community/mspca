import { requireEnv } from './env';

describe('requireEnv', () => {
  const NAME = 'REQUIRE_ENV_TEST_VAR';

  afterEach(() => {
    delete process.env[NAME];
  });

  it('returns the value when the variable is set', () => {
    process.env[NAME] = 'value';

    expect(requireEnv(NAME)).toBe('value');
  });

  it('throws when the variable is unset', () => {
    expect(() => requireEnv(NAME)).toThrow(`${NAME} is not set`);
  });

  it('throws when the variable is whitespace-only', () => {
    process.env[NAME] = '   ';

    expect(() => requireEnv(NAME)).toThrow(`${NAME} is not set`);
  });
});
