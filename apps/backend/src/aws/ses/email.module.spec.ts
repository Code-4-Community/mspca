import { AWSSESModule } from './email.module';

describe('AWSSESModule', () => {
  const ENV_VARS = [
    'SES_ENABLED',
    'AWS_REGION',
    'AWS_ACCESS_KEY_ID',
    'AWS_SECRET_ACCESS_KEY',
    'AWS_SES_SENDER_EMAIL',
  ] as const;

  const REQUIRED_WHEN_ENABLED = [
    'AWS_REGION',
    'AWS_ACCESS_KEY_ID',
    'AWS_SECRET_ACCESS_KEY',
    'AWS_SES_SENDER_EMAIL',
  ] as const;

  const originalEnv: Record<string, string | undefined> = {};
  let module: AWSSESModule;
  let warnSpy: jest.SpyInstance;
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    for (const name of ENV_VARS) {
      originalEnv[name] = process.env[name];
    }

    // Default to a fully-configured, enabled setup; individual tests override.
    process.env.SES_ENABLED = 'true';
    process.env.AWS_REGION = 'us-east-2';
    process.env.AWS_ACCESS_KEY_ID = 'test-access-key-id';
    process.env.AWS_SECRET_ACCESS_KEY = 'test-secret-access-key';
    process.env.AWS_SES_SENDER_EMAIL = 'sender@example.com';

    module = new AWSSESModule();

    warnSpy = jest
      .spyOn(module['logger'], 'warn')
      .mockImplementation(() => undefined);
    logSpy = jest
      .spyOn(module['logger'], 'log')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();

    for (const name of ENV_VARS) {
      if (originalEnv[name] === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = originalEnv[name];
      }
    }
  });

  describe('onModuleInit', () => {
    it('logs when all required env vars are set and enabled', () => {
      module.onModuleInit();

      expect(warnSpy).not.toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalledWith('SES enabled');
    });

    it('does not warn when disabled, even if required vars are missing', () => {
      process.env.SES_ENABLED = 'false';
      for (const name of REQUIRED_WHEN_ENABLED) {
        delete process.env[name];
      }

      module.onModuleInit();

      expect(warnSpy).not.toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('SES disabled'),
      );
    });

    it('does not warn when SES_ENABLED is unset', () => {
      delete process.env.SES_ENABLED;
      for (const name of REQUIRED_WHEN_ENABLED) {
        delete process.env[name];
      }

      module.onModuleInit();

      expect(warnSpy).not.toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('SES disabled'),
      );
    });

    it.each(REQUIRED_WHEN_ENABLED)(
      'throws when enabled and %s is missing',
      (name) => {
        delete process.env[name];

        expect(() => module.onModuleInit()).toThrow(name);
        expect(logSpy).not.toHaveBeenCalledWith('SES enabled');
      },
    );

    it('throws when enabled and a required var is empty/whitespace-only', () => {
      process.env.AWS_SES_SENDER_EMAIL = '   ';

      expect(() => module.onModuleInit()).toThrow('AWS_SES_SENDER_EMAIL');
    });

    it('lists every missing env var in the error', () => {
      delete process.env.AWS_REGION;
      delete process.env.AWS_SES_SENDER_EMAIL;

      expect(() => module.onModuleInit()).toThrow(
        'AWS_REGION, AWS_SES_SENDER_EMAIL',
      );
    });
  });
});
