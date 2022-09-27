import { BadRequestException, Body, Controller, Post } from "@nestjs/common";
import { ApiOperation, ApiProperty, ApiResponse, ApiTags } from "@nestjs/swagger";
import { IsString } from "class-validator";
import { encrypt } from "../common/helpers/utils";
import { Public } from '../common/decorators/auth.decorator';
import { Logger } from "@nevermined-io/nevermined-sdk-js";

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

@ApiTags('Encrypt')
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
    Logger.debug('Serving encrypt')
    if (encryptData.method !== 'PSK-ECDSA' && encryptData.method !== 'PSK-RSA') {
      Logger.error(`Unknown encryption method ${encryptData.method}`)
      throw new BadRequestException('Only PSK-ECDSA or PSK-RSA encryption allowed');
    }
    const { result, publicKey } = await encrypt(encryptData.message, encryptData.method);
    return {
        'public-key': publicKey,
        'method': encryptData.method,
        'hash': result,
    };
  }
}
