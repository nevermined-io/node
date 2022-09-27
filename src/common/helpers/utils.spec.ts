import { readFileSync } from "fs"
import { decrypt, encrypt } from "./utils"

describe('utils', () => {
    const msg = 'tervvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvfkvfmfdlkvmdlfkvmldfkmvldkfmvldkfmvldkfmvldkfmvlkdmfvlkdmflvkmdflvkmdlfkvmldfkvmldkmest'
    const config = {
            provider_password: process.env.PROVIDER_PASSWORD,
            provider_key: readFileSync(process.env.PROVIDER_KEYFILE).toString(),
            provider_rsa_public: readFileSync(process.env.RSA_PUBKEY_FILE).toString(),
            provider_rsa_private: readFileSync(process.env.RSA_PRIVKEY_FILE).toString(),
    }
    it('should encrypt and decrypt using RSA', async () => {
        const { result } = await encrypt(config, msg, 'PSK-RSA')
        const msg_ = await decrypt(config, result, 'PSK-RSA')
        expect(msg_).toBe(msg)
    })
    it('should encrypt and decrypt using ECDSA', async () => {
        const { result } = await encrypt(config, msg, 'PSK-ECDSA')
        const msg_ = await decrypt(config, result, 'PSK-ECDSA')
        expect(msg_).toBe(msg)
    })
})
