import type { Config } from 'jest'

const config: Config = {
  verbose: true,
  testTimeout: 300000,
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
  transformIgnorePatterns: [
    '<rootDir>/node_modules/*',
    '<rootDir>/config/*',
    '<rootDir>/dist/*',
    '<rootDir>/.yalc/*',
  ],
}

export default config
