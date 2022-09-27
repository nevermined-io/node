const LogLevel = require('@nevermined-io/nevermined-sdk-js/dist/node/utils').LogLevel
const ethers = require('ethers').ethers
const fs = require('fs')

const nograph = process.env['NO_GRAPH'] === 'true'

const configBase = {
    nodeUri: process.env['KEEPER_URL'] || 'http://localhost:8545',
    marketplaceUri: process.env['MARKETPLACE_URI'] || 'http://nevermined-metadata:3100',
    faucetUri: process.env['FAUCET_URI'] || 'http://localhost:3001',
    gatewayUri: process.env['GATEWAY_URI'] || 'http://localhost:8030',
    gatewayAddress: process.env['GATEWAY_ADDRESS'] || '0x068ed00cf0441e4829d9784fcbe7b9e26d4bd8d0',
    artifactsFolder: './artifacts',
    marketplaceAuthToken: process.env['MARKETPLACE_AUTH_TOKEN'] || 'bogus',
    graphHttpUri: nograph
        ? undefined
        : process.env['GRAPH_HTTP_URI'] || 'http://localhost:9000/subgraphs/name/nevermined-io/development',
    gasMultiplier: 1.1,
    verbose: LogLevel.Error
}

configBase.accounts = []

if (process.env.PROVIDER_KEYFILE) {
    const str = fs.readFileSync(process.env.PROVIDER_KEYFILE).toString()
    configBase.accounts = [ethers.Wallet.fromEncryptedJsonSync(str, process.env.PROVIDER_PASSWORD)]
}

const config = configBase
config.forceVerbose = { ...configBase, verbose: true }

module.exports = {
    config
}
