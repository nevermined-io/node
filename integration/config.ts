import {
  LoggerInstance,
  LogLevel,
  makeWallets,
  NeverminedOptions,
  NvmAccount,
} from '@nevermined-io/sdk'
import { Account } from 'viem'

LoggerInstance.setLevel(LogLevel.Error)

const logLevel = Number(process.env['LOG_LEVEL']) || 1 // warn by default

const configBase: NeverminedOptions = {
  chainId: 1337,
  web3ProviderUri: 'http://contracts.nevermined.localnet',
  marketplaceUri: 'http://marketplace.nevermined.localnet',
  neverminedNodeUri: process.env.NEVERMINED_NODE_URI || 'http://localhost:8030',
  neverminedNodeAddress: '0x068ed00cf0441e4829d9784fcbe7b9e26d4bd8d0',
  marketplaceAuthToken: undefined,
  artifactsFolder: './artifacts',
  circuitsFolder: './circuits',
  gasMultiplier: 1.1,
  verbose: logLevel,
}

if (process.env.SEED_WORDS) {
  const wallets = makeWallets(process.env.SEED_WORDS)
  configBase.accounts = wallets.map((wallet) => {
    const a = NvmAccount.fromAccount(wallet)
    const signer = a.getAccountSigner() as Account
    LoggerInstance.debug(`Account loaded with address ${a.getAddress()} and type: ${signer.type}`)
    return a
  })
}

export const config: NeverminedOptions & { forceVerbose: NeverminedOptions } = configBase as any
;(config as any).forceVerbose = { ...configBase, verbose: true }
