import { NotificationsModule } from './notifications.module';

// VolunteersModule reaches CognitoModule, whose guard imports jwks-rsa. Its ESM
// `jose` dependency cannot be parsed by Jest, so it is stubbed out here.
jest.mock('jwks-rsa', () => ({ __esModule: true, default: jest.fn() }));

describe('NotificationsModule', () => {
  const REQUIRED_FOR_SCHEDULING = [
    'AWS_REGION',
    'AWS_ACCESS_KEY_ID',
    'AWS_SECRET_ACCESS_KEY',
    'AWS_NOTIFICATION_DISPATCH_LAMBDA_ARN',
    'AWS_SCHEDULER_ROLE_ARN',
    'NOTIFICATIONS_DISPATCH_SECRET',
  ] as const;

  const originalEnv: Record<string, string | undefined> = {};
  let module: NotificationsModule;
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    for (const name of REQUIRED_FOR_SCHEDULING) {
      originalEnv[name] = process.env[name];
    }

    // Default to a fully-configured setup; individual tests override.
    process.env.AWS_REGION = 'us-east-2';
    process.env.AWS_ACCESS_KEY_ID = 'test-access-key-id';
    process.env.AWS_SECRET_ACCESS_KEY = 'test-secret-access-key';
    process.env.AWS_NOTIFICATION_DISPATCH_LAMBDA_ARN = 'arn:aws:lambda:::fn';
    process.env.AWS_SCHEDULER_ROLE_ARN = 'arn:aws:iam:::role/scheduler';
    process.env.NOTIFICATIONS_DISPATCH_SECRET = 'test-secret';

    module = new NotificationsModule();
    logSpy = jest
      .spyOn(module['logger'], 'log')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    for (const name of REQUIRED_FOR_SCHEDULING) {
      if (originalEnv[name] === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = originalEnv[name];
      }
    }
    jest.restoreAllMocks();
  });

  it('reports scheduling as enabled when every var is set', () => {
    module.onModuleInit();

    expect(logSpy).toHaveBeenCalledWith('Scheduled notifications enabled');
  });

  it.each(REQUIRED_FOR_SCHEDULING)('names %s when it is missing', (name) => {
    delete process.env[name];

    module.onModuleInit();

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining(`missing env vars (${name})`),
    );
  });

  // Whitespace is as unusable as unset, and getMissingEnvVars treats it that way.
  it('counts a whitespace-only var as missing', () => {
    process.env.AWS_SCHEDULER_ROLE_ARN = '   ';

    module.onModuleInit();

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('AWS_SCHEDULER_ROLE_ARN'),
    );
  });

  it('says immediate sends still work when scheduling is unconfigured', () => {
    delete process.env.AWS_SCHEDULER_ROLE_ARN;

    module.onModuleInit();

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('Immediate sends still work'),
    );
  });
});
