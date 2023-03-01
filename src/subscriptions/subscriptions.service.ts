import { BadRequestException, Injectable } from '@nestjs/common'
import { DDOServiceNotFoundError, findServiceConditionByName, Service } from '@nevermined-io/sdk'
import { NeverminedService } from '../shared/nevermined/nvm.service'
import * as jose from 'jose'
import { ConfigService } from '../shared/config/config.service'

export interface SubscriptionData {
  numberNfts: number
  contractAddress: string
  endpoints: string[]
  headers: { [key: string]: string }[]
}

@Injectable()
export class SubscriptionsService {
  private readonly jwtSecret: Uint8Array
  public readonly neverminedProxyUri: string

  constructor(private nvmService: NeverminedService, private config: ConfigService) {
    this.jwtSecret = this.config.subscriptionsConfig().jwtSecret
    this.neverminedProxyUri = this.config.subscriptionsConfig().neverminedProxyUri
  }

  /**
   * Validates if a DID has an associated subscription
   *
   * @param did - The DID of the asset with an associated subscription
   *
   * @throws {@link BadRequestException}
   * @returns {@link SubscriptionData}
   */
  public async validateDid(did: string): Promise<SubscriptionData> {
    // get the DDO
    const ddo = await this.nvmService.nevermined.assets.resolve(did)
    if (!ddo) {
      throw new BadRequestException(`${did} not found.`)
    }

    // get the nft-access service
    let nftAccessService: Service<'nft-access'>
    try {
      nftAccessService = ddo.findServiceByType('nft-access')
    } catch (e) {
      if (e instanceof DDOServiceNotFoundError) {
        throw new BadRequestException(`${did} does not contain an 'nft-access' service`)
      } else {
        throw e
      }
    }

    // get the nft-holder condition
    const nftHolderCondition = findServiceConditionByName(nftAccessService, 'nftHolder')
    const numberNfts = Number(
      nftHolderCondition.parameters.find((p) => p.name === '_numberNfts').value,
    )
    const contractAddress = nftHolderCondition.parameters.find((p) => p.name === '_contractAddress')
      .value as string

    // get the web-service endpoints
    const metadata = ddo.findServiceByType('metadata')
    if (!metadata.attributes.main.webService) {
      throw new BadRequestException(`${did} does not contain any web services`)
    }
    const endpoints = metadata.attributes.main.webService.endpoints.flatMap((e) => Object.values(e))

    // decrypt the headers
    const headers = await this.nvmService.decrypt(
      metadata.attributes.main.webService.encryptedAttributes,
      'PSK-RSA',
    )

    return {
      numberNfts,
      contractAddress,
      endpoints,
      headers,
    }
  }

  /**
   * Validates if a subscription is valid or not
   *
   * @param contractAddress - The NFT-721 contract address
   * @param numberNfts - Amount of `contractAddress` nfts a user needs to hold in order to get access to the subscription
   * @param userAddress - The ethereum address of the user
   *
   * @returns {@link boolean}
   */
  public async isSubscriptionValid(
    contractAddress: string,
    numberNfts: number,
    userAddress: string,
  ): Promise<boolean> {
    const nft = await this.nvmService.nevermined.contracts.loadNft721(contractAddress)
    const balance = await nft.balanceOf(userAddress)

    return balance.toNumber() >= numberNfts
  }

  public async generateToken(
    did: string,
    userAddress: string,
    endpoints: any,
    headers?: any,
  ): Promise<string> {
    return await new jose.EncryptJWT({
      did: did,
      userId: userAddress,
      endpoints,
      headers,
    })
      .setProtectedHeader({ alg: 'dir', enc: 'A128CBC-HS256' })
      .setIssuedAt()
      .setExpirationTime('1w')
      .encrypt(this.jwtSecret)
  }
}
