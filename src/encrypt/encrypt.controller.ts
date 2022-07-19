import { BadRequestException, Body, Controller, Post } from "@nestjs/common";
import { ApiOperation, ApiProperty, ApiResponse, ApiTags } from "@nestjs/swagger";
import { IsString } from "class-validator";
import { ethers } from "ethers";
import { readFileSync } from "fs";
import path from "path";
import { Public } from '../common/decorators/auth.decorator';

export class EncryptResult {
    'public-key': string;
    hash: string;
    method: string;
}

export class EncryptDto {
    @ApiProperty({
        example: 'PSK-ECDSA',
        description: 'Encryption method',
    })
    @IsString()
    method: string;
    @ApiProperty({
        example: 'Hello!',
        description: 'Encrypted message',
    })
    @IsString()
    message: string;
}

@ApiTags('Info')
@Controller()
export class EncryptController {
  @Post()
  @ApiOperation({
    description: 'Encrypt',
    summary: 'Public',
  })
  @ApiResponse({
    status: 200,
    description: 'Return encrypted stuff',
    type: EncryptResult,
  })
  @Public()
  async doEncrypt(@Body() encryptData: EncryptDto): Promise<EncryptResult> {
    if (encryptData.method !== 'PSK-ECDSA') {
        throw new BadRequestException('Only ECDSA encryption allowed')
    }
    const provider_key_file = readFileSync(path.join(__dirname, '../../..', process.env['PROVIDER_KEYFILE'] || '')).toString()
    const provider_password = process.env['PROVIDER_PASSWORD'] || ''
    const wallet = await ethers.Wallet.fromEncryptedJson(provider_key_file, provider_password, a => console.log(a))
    const result = await wallet.encrypt(encryptData.message)
    return {
        'public-key': wallet.publicKey,
        'method': encryptData.method,
        'hash': result,
    }
  }
}
