/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.test.json' }],
  },
  globalSetup: '<rootDir>/tests/jest.setup.ts',
  globalTeardown: '<rootDir>/tests/jest.teardown.ts',
  testTimeout: 30000,
  setupFiles: ['<rootDir>/tests/jest.env.ts'],
  moduleNameMapper: {
    '^mongoose$': '<rootDir>/tests/__mocks__/mongoose.ts',
    '^.*models/HierarchyNode$': '<rootDir>/tests/__mocks__/HierarchyNode.ts',
    '^.*models/AuditLog$': '<rootDir>/tests/__mocks__/AuditLog.ts',
    '^.*config/database$': '<rootDir>/tests/__mocks__/database.ts',
  },
};
