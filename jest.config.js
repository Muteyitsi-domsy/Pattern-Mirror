/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  passWithNoTests: true,
  collectCoverageFrom: ['backend/functions/src/**/*.ts', '!backend/functions/src/**/__tests__/**'],
  coverageThreshold: {
    global: {
      lines: 80,
    },
  },
};
