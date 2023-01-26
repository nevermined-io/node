import { Injectable } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { Strategy, JWTPayload } from '@nevermined-io/passport-nevermined'

@Injectable()
export class NeverminedStrategy extends PassportStrategy(Strategy) {
  async validate(payload: JWTPayload): Promise<JWTPayload> {
    return payload
  }
}
