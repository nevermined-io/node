import { Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { decodeJwt, JWTPayload } from 'jose'
import { CLIENT_ASSERTION_TYPE, EthSignJWT } from '../common/guards/shared/jwt.utils'
import { ethers } from 'ethers'

/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */

@Injectable()
export class AuthService {
  constructor(private jwtService: JwtService) {}

  validateClaim(clientAssertionType: string, clientAssertion: string) {
    if (clientAssertionType !== CLIENT_ASSERTION_TYPE) {
      throw new UnauthorizedException('Invalid "assertion_type"')
    }

    const payload: JWTPayload = decodeJwt(clientAssertion)
    delete payload.exp
    return {
      access_token: this.jwtService.sign(payload),
    }
  }
  async createToken(obj: any) {
    const wallet = ethers.Wallet.createRandom()
    const clientAssertion = await new EthSignJWT({
      ...obj,
      iss: wallet.address,
    })
      .setProtectedHeader({ alg: 'ES256K' })
      .setIssuedAt()
      .setExpirationTime('60m')
      .ethSign(wallet)

    return this.validateClaim(CLIENT_ASSERTION_TYPE, clientAssertion).access_token
  }
}
