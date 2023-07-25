import { Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { LoginDto } from './dto/login.dto'
import {
  ServiceType,
  ValidationParams,
  didZeroX,
  zeroX,
  BabyjubPublicKey,
  Logger,
  Account,
  Babysig,
  findServiceConditionByName,
} from '@nevermined-io/sdk'
import { NeverminedService } from '../shared/nevermined/nvm.service'
import { JWTPayload } from '@nevermined-io/passport-nevermined'

const BASE_URL = '/api/v1/node/services/'

@Injectable()
export class AuthService {
  constructor(private jwtService: JwtService, private nvmService: NeverminedService) {}

  async validateOwner(did: string, consumer_address: string): Promise<void> {
    const nevermined = this.nvmService.getNevermined()
    const getNftAccess = async () => {
      const ddo = await nevermined.assets.resolve(did)
      if (!ddo) {
        return null
      }
      const service = ddo.findServiceByType('nft-access')
      if (!service) {
        return null
      }
      if (service.attributes.main.ercType == 721) {
        return 1n
      }
      const holder = findServiceConditionByName(service, 'nftHolder')
      if (!holder) {
        return 1n
      }
      const num = holder.parameters.find((p) => p.name === '_numberNfts')?.value as string
      return BigInt(num)
    }

    const granted = await nevermined.keeper.conditions.accessCondition.checkPermissions(
      consumer_address,
      did,
    )
    if (!granted) {
      const limit = await getNftAccess()
      const balance = await nevermined.nfts1155.balance(did, new Account(consumer_address))
      if (!limit || balance < limit) {
        throw new UnauthorizedException(
          `Address ${consumer_address} has no permission to access ${did}`,
        )
      }
    }
  }

  async validateAccess(params: ValidationParams, service: ServiceType): Promise<void> {
    const nevermined = this.nvmService.getNevermined()

    const plugin =
      nevermined.assets.servicePlugin[service] || nevermined.nfts1155.servicePlugin[service]

    const granted = await plugin.accept(params)
    if (!granted) {
      const [from] = await nevermined.accounts.list()
      await plugin.process(params, from, undefined)
    }
  }

  async validateTransferProof(params: ValidationParams): Promise<void> {
    const dtp = this.nvmService.getDtp()
    const buyerPub = new BabyjubPublicKey(
      zeroX(params.buyer.substring(0, 64)),
      zeroX(params.buyer.substring(64, 128)),
    )
    if (
      !(await dtp.keytransfer.verifyBabyjub(
        buyerPub,
        BigInt(params.consumer_address),
        params.babysig,
      ))
    ) {
      throw new UnauthorizedException(`Bad signature for address ${params.consumer_address}`)
    }
  }

  async validateClaim(payload: JWTPayload): Promise<LoginDto> {
    try {
      const params: ValidationParams = {
        consumer_address: payload.iss,
        did: didZeroX(payload.did as string),
        agreement_id: payload.sub,
        buyer: payload.buyer as string,
        babysig: payload.babysig as Babysig,
      }

      if (payload.aud === BASE_URL + 'access') {
        await this.validateAccess(params, 'access')
      } else if (payload.aud === BASE_URL + 'download') {
        await this.validateOwner(payload.did as string, payload.iss)
      } else if (payload.aud === BASE_URL + 'nft-access') {
        await this.validateAccess(params, 'nft-access')
      } else if (payload.aud === BASE_URL + 'nft-sales-proof') {
        await this.validateTransferProof(params)
      }

      const { iat: _iat, exp: _exp, ...accessTokenPayload } = payload
      return {
        access_token: this.jwtService.sign(accessTokenPayload),
      }
    } catch (error) {
      Logger.error(error)
      throw new UnauthorizedException(
        `The 'client_assertion' is invalid: ${(error as Error).message}`,
      )
    }
  }
}
