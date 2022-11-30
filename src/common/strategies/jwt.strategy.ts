import { Injectable } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { JWTPayload } from 'jose'
import { ExtractJwt, Strategy } from 'passport-jwt'
import { ConfigService } from '../../shared/config/config.service'

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get('JWT_SECRET_KEY'),
    })
  }

  validate(payload: JWTPayload) {
    return {
      userId: payload.sub,
      address: payload.iss,
      roles: payload.roles,
      did: payload.did,
    }
  }
}
