const LogLevel = require('@nevermined-io/sdk').LogLevel
const ethers = require('ethers').ethers
const { NeverminedOptions } = require('@nevermined-io/sdk')
const fs = require('fs')

const configBase = {
  chainId: process.env['NETWORK_ID'] || 1337,
  web3ProviderUri: process.env['WEB3_PROVIDER_URL'] || 'http://contracts.nevermined.localnet',
  marketplaceUri: process.env['MARKETPLACE_URI'] || 'http://marketplace.nevermined.localnet',
  neverminedNodeUri: process.env['NODE_URI'] || 'http://localhost:8030',
  neverminedNodeAddress:
    process.env['NODE_ADDRESS'] || '0x068ed00cf0441e4829d9784fcbe7b9e26d4bd8d0',
  artifactsFolder: process.env['ARTIFACTS_FOLDER'] || './artifacts',
  circuitsFolder: process.env['CIRCUITS_FOLDER'] || './circuits',
  graphHttpUri: process.env['GRAPH_HTTP_URI'],
  gasMultiplier: 1.1,
  verbose: Number(process.env['NEVERMINED_SDK_LOG_LEVEL']) || LogLevel.Error,
}

configBase.accounts = []

if (process.env.PROVIDER_KEYFILE) {
  const str = fs.readFileSync(process.env.PROVIDER_KEYFILE).toString()
  configBase.accounts = [ethers.Wallet.fromEncryptedJsonSync(str, process.env.PROVIDER_PASSWORD)]
}

const config = configBase
config.forceVerbose = { ...configBase, verbose: true }

module.exports = {
  config,
}
