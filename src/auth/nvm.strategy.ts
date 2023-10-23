import { Injectable } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { Strategy, JWTPayload } from '@nevermined-io/passport-nevermined'
import { ConfigService } from '../shared/config/config.service'

@Injectable()
export class NeverminedStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    const nvmConfig = configService.nvm()
    super({
      web3ProviderUri: nvmConfig.web3ProviderUri,
    })
  }

  async validate(payload: JWTPayload): Promise<JWTPayload> {
    return payload
  }
}
