import type { Config } from 'jest'

const config: Config = {
  verbose: true,
  testTimeout: 30000,
  moduleFileExtensions: ['js', 'json', 'ts'],
  setupFiles: ['jest-date-mock'],
  roots: ['src', 'integration'],
  testRegex: '.spec.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
  restoreMocks: true,
}

export default config
