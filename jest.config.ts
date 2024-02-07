export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  transformIgnorePatterns: ['/node_modules/(?!core-js)/'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'json'],
  collectCoverage: false,
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!**/node_modules/**',
    '!**/vendor/**',
  ],
  testMatch: ['<rootDir>/**/*.test.ts'],
  testPathIgnorePatterns: [
    '/node_modules/',
    '<rootDir>/config/', // in case of config.test.ts
    '<rootDir>/mock/',
    '<rootDir>/.umirc.test.ts',
  ],
  testTimeout: 30000,
  modulePathIgnorePatterns: [
    '<rootDir>/packages/.+/compiled',
    '<rootDir>/packages/.+/fixtures',
  ],
  setupFiles: ['./jest.setup.js'],
  resolver: require.resolve('./resolver.js'),
};
