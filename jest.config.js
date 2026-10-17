/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/backend/functions/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  collectCoverageFrom: ['backend/functions/src/**/*.ts', '!backend/functions/src/**/__tests__/**'],
  coverageThreshold: {
    global: {
      lines: 80,
    },
  },
};
