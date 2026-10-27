/* eslint-disable */
export default {
  displayName: 'apps/backend',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  setupFiles: ['<rootDir>/jest.setup.ts'],
  coverageDirectory: '../../coverage/apps/backend',
};
