module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  setupFiles: ['<rootDir>/tests/helpers/loadEnv.js'],
  setupFilesAfterEnv: ['<rootDir>/tests/helpers/setup.js'],
  testPathIgnorePatterns: ['/node_modules/', '/tests/helpers/'],
  verbose: false,
  testTimeout: 15000,
};
