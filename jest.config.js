module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/server'],
  testMatch: [
    '**/__tests__/**/*.ts',
    '**/?(*.)+(spec|test).ts'
  ],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverageFrom: [
    'server/**/*.ts',
    '!server/**/*.d.ts',
    '!server/index.ts',
    '!server/**/__tests__/**',
    '!server/**/node_modules/**'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: ['<rootDir>/server/__tests__/setup.ts'],
  testTimeout: 10000,
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/server/$1',
    '^@models/(.*)$': '<rootDir>/server/models/$1',
    '^@services/(.*)$': '<rootDir>/server/services/$1',
    '^@controllers/(.*)$': '<rootDir>/server/controllers/$1',
    '^@middleware/(.*)$': '<rootDir>/server/middleware/$1',
    '^@utils/(.*)$': '<rootDir>/server/utils/$1',
    '^@types/(.*)$': '<rootDir>/server/types/$1'
  }
};