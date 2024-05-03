import { BadRequestException, Body, Controller, Post } from '@nestjs/common'
import { ApiBadRequestResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { Logger } from '@nevermined-io/sdk'
import { Public } from '../common/decorators/auth.decorator'
import { encrypt } from '../common/helpers/encryption.helper'
import { ConfigService } from '../shared/config/config.service'
import { EncryptDto } from './dto/encrypt'
import { EncryptResult } from './dto/result'

@ApiTags('Encrypt')
@Controller()
export class EncryptController {
  constructor(private config: ConfigService) {}
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
  @ApiBadRequestResponse({
    status: 400,
    description: 'Bad Request. Incorrect encryption method',
    type: BadRequestException,
  })
  @Public()
  async doEncrypt(@Body() encryptData: EncryptDto): Promise<EncryptResult> {
    Logger.debug('Serving encrypt')
    if (encryptData.method !== 'PSK-ECDSA' && encryptData.method !== 'PSK-RSA') {
      Logger.error(`Unknown encryption method ${encryptData.method}`)
      throw new BadRequestException('Only PSK-ECDSA or PSK-RSA encryption allowed')
    }
    const encription = await encrypt(
      this.config.cryptoConfig(),
      encryptData.message,
      encryptData.method,
    )
    if (!encription) {
      Logger.error('Error encrypting')
      throw new BadRequestException('Error encrypting')
    }
    return {
      'public-key': encription.publicKey,
      method: encryptData.method,
      hash: encription.result,
    }
  }
}
