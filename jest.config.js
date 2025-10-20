module.exports = {
  testEnvironment: 'node',
  preset: 'ts-jest',
  rootDir: '.',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      diagnostics: {
        ignoreCodes: [2307], // Ignore "Cannot find module" errors for mocked modules
      },
    }],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/.vscode/',
    '/.cursor/',
  ],
  modulePathIgnorePatterns: [
    '/node_modules/',
  ],
  moduleNameMapper: {
    '^keytar$': '<rootDir>/tests/__mocks__/keytar.js',
  },
};