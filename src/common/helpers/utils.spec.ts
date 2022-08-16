import { decrypt, encrypt } from "./utils"

describe('utils', () => {
    const msg = 'tervvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvfkvfmfdlkvmdlfkvmldfkmvldkfmvldkfmvldkfmvldkfmvlkdmfvlkdmflvkmdflvkmdlfkvmldfkvmldkmest'
    it('should encrypt and decrypt using RSA', async () => {
        const { result } = await encrypt(msg, 'PSK-RSA')
        const msg_ = await decrypt(result, 'PSK-RSA')
        expect(msg_).toBe(msg)
    })
    it('should encrypt and decrypt using ECDSA', async () => {
        const { result } = await encrypt(msg, 'PSK-ECDSA')
        const msg_ = await decrypt(result, 'PSK-ECDSA')
        expect(msg_).toBe(msg)
    })
})
