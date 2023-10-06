import { LoggerInstance, LogLevel, makeAccounts, NeverminedOptions } from '@nevermined-io/sdk'

LoggerInstance.setLevel(LogLevel.Error)

const logLevel = Number(process.env['LOG_LEVEL']) || 1 // warn by default

const configBase: NeverminedOptions = {
  web3ProviderUri: 'http://contracts.nevermined.localnet',
  marketplaceUri: 'http://marketplace.nevermined.localnet',
  neverminedNodeUri: 'http://localhost:8030',
  neverminedNodeAddress: '0x068ed00cf0441e4829d9784fcbe7b9e26d4bd8d0',
  marketplaceAuthToken: undefined,
  artifactsFolder: './artifacts',
  circuitsFolder: './circuits',
  gasMultiplier: 1.1,
  verbose: logLevel,
}

if (process.env.SEED_WORDS) {
  configBase.accounts = makeAccounts(process.env.SEED_WORDS)
}

export const config: NeverminedOptions & { forceVerbose: NeverminedOptions } = configBase as any
;(config as any).forceVerbose = { ...configBase, verbose: true }
