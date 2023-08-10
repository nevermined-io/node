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
  DDO,
  jsonReplacer,
  NeverminedNFT1155Type,
} from '@nevermined-io/sdk'
import { NeverminedService } from '../shared/nevermined/nvm.service'
import { JWTPayload } from '@nevermined-io/passport-nevermined'

const BASE_URL = '/api/v1/node/services/'

@Injectable()
export class AuthService {
  constructor(private jwtService: JwtService, private nvmService: NeverminedService) {}

  async validateOwner(params: ValidationParams): Promise<void> {
    const nevermined = this.nvmService.getNevermined()
    const ddo = await nevermined.assets.resolve(params.did)
    Logger.debug(`Validating owner for ${params.did}`)

    const getNftAccess = async (ddo: DDO, serviceIndex?: number) => {
      if (!ddo) {
        return null
      }
      const service =
        serviceIndex && serviceIndex > 0
          ? ddo.findServiceByIndex(serviceIndex)
          : ddo.findServiceByType('nft-access')

      if (!service) {
        return null
      }
      if (service.attributes.main.ercType == 721) {
        return 1n
      }
      const holder = DDO.findServiceConditionByName(service, 'nftHolder')
      if (!holder) {
        return 1n
      }
      const num = holder.parameters.find((p) => p.name === '_numberNfts')?.value as string
      return BigInt(num)
    }

    const granted = await nevermined.keeper.conditions.accessCondition.checkPermissions(
      params.consumer_address,
      params.did,
    )
    if (!granted) {
      const limit = await getNftAccess(ddo, params.service_index)
      const balance = await nevermined.nfts1155.balance(
        params.did,
        new Account(params.consumer_address),
      )
      if (!limit || balance < limit) {
        throw new UnauthorizedException(
          `Address ${params.consumer_address} has no permission to access ${params.did}`,
        )
      }
    }

    const metadataService = ddo.findServiceByType('metadata')
    const isNft1155Credit =
      metadataService.attributes.main.nftType &&
      metadataService.attributes.main.nftType.toString() ===
        NeverminedNFT1155Type.nft1155Credit.toString()
    if (isNft1155Credit) {
      Logger.debug(`Validating NFT1155 Credit for ${params.did}`)
      const [from] = await nevermined.accounts.list()
      const plugin = nevermined.nfts1155.servicePlugin['nft-access']

      try {
        await plugin.track(params, from)
      } catch (error) {
        throw new UnauthorizedException(
          `Address ${params.consumer_address} could not use the credits to access ${params.did}`,
        )
      }
    }
  }

  async validateAccess(params: ValidationParams, service: ServiceType): Promise<void> {
    const nevermined = this.nvmService.getNevermined()

    const plugin =
      nevermined.assets.servicePlugin[service] || nevermined.nfts1155.servicePlugin[service]

    console.debug(`Params: ${JSON.stringify(params, jsonReplacer)}`)
    console.debug(`Service Type: ${service}`)
    // console.debug(`Plugin: ${JSON.stringify(plugin, jsonReplacer)}`)

    try {
      const [from] = await nevermined.accounts.list()
      const granted = await plugin.accept(params)
      if (!granted) {
        await plugin.process(params, from, undefined)
      }

      await plugin.track(params, from)
    } catch (error) {
      throw new UnauthorizedException(`Error processing request: ${error.message}`)
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
        service_index: payload.service_index as number,
      }

      if (payload.aud === BASE_URL + 'access') {
        await this.validateAccess(params, 'access')
      } else if (payload.aud === BASE_URL + 'download') {
        await this.validateOwner(params)
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
