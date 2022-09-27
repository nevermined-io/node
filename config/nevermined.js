const LogLevel = require('@nevermined-io/nevermined-sdk-js/dist/node/utils').LogLevel
const ethers = require('ethers').ethers
const fs = require('fs')

const nograph = process.env['NO_GRAPH'] === 'true'

const configBase = {
    nodeUri: process.env['KEEPER_URL'] || 'http://localhost:8545',
    marketplaceUri: 'http://nevermined-metadata:3100',
    faucetUri: 'http://localhost:3001',
    gatewayUri: 'http://localhost:8030',
    secretStoreUri: 'http://localhost:12001',
    gatewayAddress: '0x068ed00cf0441e4829d9784fcbe7b9e26d4bd8d0',
    artifactsFolder: './artifacts',
    marketplaceAuthToken: 'bogus',
    graphHttpUri: nograph
        ? undefined
        : 'http://localhost:9000/subgraphs/name/nevermined-io/development',
    gasMultiplier: 1.1,
    verbose: LogLevel.Error
}

if (process.env.NETWORK_NAME === 'production') {
    Object.assign(configBase, {
        nodeUri: 'http://localhost:8545',
        marketplaceUri: 'http://nevermined-metadata:3100',
        faucetUri: 'http://localhost:3001',
        gatewayUri: 'http://localhost:8030',
        secretStoreUri: 'http://localhost:12001',
        gatewayAddress: '0x068ed00cf0441e4829d9784fcbe7b9e26d4bd8d0'
    })
}

if (process.env.NETWORK_NAME === 'integration') {
    Object.assign(configBase, {
        nodeUri: 'http://localhost:8545',
        marketplaceUri: 'http://nevermined-metadata:3100',
        faucetUri: 'http://localhost:3001',
        gatewayUri: 'http://localhost:8030',
        secretStoreUri: 'http://localhost:12001',
        gatewayAddress: '0x068ed00cf0441e4829d9784fcbe7b9e26d4bd8d0'
    })
}

if (process.env.NETWORK_NAME === 'testing') {
    Object.assign(configBase, {
        nodeUri: 'http://localhost:8545',
        marketplaceUri: 'http://nevermined-metadata:3100',
        faucetUri: 'http://localhost:3001',
        gatewayUri: 'http://localhost:8030',
        secretStoreUri: 'http://localhost:12001',
        gatewayAddress: '0x068ed00cf0441e4829d9784fcbe7b9e26d4bd8d0'
    })
}

if (process.env.NETWORK_NAME === 'rinkeby') {
    Object.assign(configBase, {
        marketplaceUri: 'https://metadata.rinkeby.nevermined.rocks',
        faucetUri: 'https://faucet.rinkeby.nevermined.rocks',
        gatewayUri: 'https://gateway.rinkeby.nevermined.rocks',
        nodeUri: `https://rinkeby.infura.io/v3/52b6d403f7de4757ab9ed23c3778a35b`,
        gatewayAddress: '0x068Ed00cF0441e4829D9784fCBe7b9e26D4BD8d0'
    })
}

if (process.env.NETWORK_NAME === 'mumbai') {
    Object.assign(configBase, {
        marketplaceUri: 'https://metadata.mumbai.nevermined.rocks',
        faucetUri: 'https://faucet.mumbai.nevermined.rocks',
        gatewayUri: 'https://gateway.mumbai.nevermined.rocks',
        nodeUri: `https://rpc-mumbai.maticvigil.com/v1/e145ac0424e2a2b3c340685c80a08e77099ce020`,
        gatewayAddress: '0x068Ed00cF0441e4829D9784fCBe7b9e26D4BD8d0'
    })
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
