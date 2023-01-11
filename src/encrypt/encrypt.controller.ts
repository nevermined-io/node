import { BadRequestException, Body, Controller, Post } from '@nestjs/common'
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { Public } from '../common/decorators/auth.decorator'
import { Logger } from '@nevermined-io/nevermined-sdk-js'
import { EncryptDto } from './dto/encrypt'
import { EncryptResult } from './dto/result'
import { ConfigService } from '../shared/config/config.service'
import { encrypt } from '@nevermined-io/nevermined-sdk-dtp'

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
  @Public()
  async doEncrypt(@Body() encryptData: EncryptDto): Promise<EncryptResult> {
    Logger.debug('Serving encrypt')
    if (encryptData.method !== 'PSK-ECDSA' && encryptData.method !== 'PSK-RSA') {
      Logger.error(`Unknown encryption method ${encryptData.method}`)
      throw new BadRequestException('Only PSK-ECDSA or PSK-RSA encryption allowed')
    }
    const { result, publicKey } = await encrypt(
      this.config.cryptoConfig(),
      encryptData.message,
      encryptData.method,
    )
    return {
      'public-key': publicKey,
      method: encryptData.method,
      hash: result,
    }
  }
}
