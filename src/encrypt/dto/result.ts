
import { ApiProperty } from "@nestjs/swagger";

export class EncryptResult {
    @ApiProperty({
        description: 'Public key used by the node'
    })
    'public-key': string;
    @ApiProperty({
        description: 'Encrypted data'
    })
    hash: string;
    @ApiProperty({
        description: 'Encryption method (PSK-ECDSA or PSK-RSA)',
        example: 'PSK-ECDSA'
    })
    method: string;
}

