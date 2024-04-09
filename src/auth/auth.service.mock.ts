import { Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { decodeJwt, JWTPayload } from 'jose'
import { CLIENT_ASSERTION_TYPE } from '../common/guards/shared/jwt.utils'
import { EthSignJWT, NvmAccount, makeRandomWallet } from '@nevermined-io/sdk'
import { NeverminedService } from 'src/shared/nevermined/nvm.service'

/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private nvmService: NeverminedService,
  ) {}

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
  async createToken(obj: any, signer?: NvmAccount) {
    signer = signer || NvmAccount.fromAccount(makeRandomWallet())
    const clientAssertion = await new EthSignJWT({
      ...obj,
      iss: await signer.getAddress(),
    })
      .setProtectedHeader({ alg: 'ES256K' })
      .setIssuedAt()
      .setExpirationTime('60m')
      .ethSign(this.nvmService.nevermined.utils.signature, signer)

    return this.validateClaim(CLIENT_ASSERTION_TYPE, clientAssertion).access_token
  }
}
