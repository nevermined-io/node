
const keys = [
    'JWT_SECRET_KEY',
    'JWT_EXPIRY_KEY',
  
    'PROVIDER_KEYFILE',
    'RSA_PRIVKEY_FILE',
    'RSA_PUBKEY_FILE',
  
    'PROVIDER_BABYJUB_SECRET',
    'BUYER_BABYJUB_SECRET',
    'PROVIDER_BABYJUB_PUBLIC1',
    'PROVIDER_BABYJUB_PUBLIC2',
    'BUYER_BABYJUB_PUBLIC1',
    'BUYER_BABYJUB_PUBLIC2',
    'PROVIDER_PASSWORD',
  
    'ESTUARY_TOKEN',
]

const config = {}

for (let k of keys) {
    config[k] = process.env[k]
}

module.exports = {
    config
}