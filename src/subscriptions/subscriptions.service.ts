import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common'
import {
  DDO,
  DDOError,
  DID,
  findServiceConditionByName,
  NFT721Api,
  Service,
} from '@nevermined-io/sdk'
import { NeverminedService } from '../shared/nevermined/nvm.service'
import * as jose from 'jose'
import { ConfigService } from '../shared/config/config.service'
import { Logger } from '../shared/logger/logger.service'

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
  public readonly defaultExpiryTime: string
  private readonly averageBlockTime: number

  constructor(private nvmService: NeverminedService, private config: ConfigService) {
    this.jwtSecret = this.config.subscriptionsConfig().jwtSecret
    this.neverminedProxyUri = this.config.subscriptionsConfig().neverminedProxyUri
    this.defaultExpiryTime = this.config.subscriptionsConfig().defaultExpiryTime
    this.averageBlockTime = this.config.subscriptionsConfig().averageBlockTime
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
    let ddo: DDO

    // validate DID
    try {
      DID.parse(did)
    } catch (e) {
      Logger.debug(`[GET /subscriptions] error parsing DID ${did}: ${e}`)
      throw new BadRequestException(`${did} is not a valid DID.`)
    }

    // get the DDO
    try {
      ddo = await this.nvmService.nevermined.assets.resolve(did)
    } catch (e) {
      throw new BadRequestException(`${did} not found.`)
    }
    if (!ddo) {
      Logger.debug(`[GET /subscriptions] error resolving DID ${did}: resolve(did) returned null`)
      throw new BadRequestException(`${did} not found.`)
    }

    // ddo should be of type service
    let metadataService: Service<'metadata'>
    try {
      metadataService = ddo.findServiceByType('metadata')
    } catch (e) {
      if (e instanceof DDOError) {
        Logger.debug(`[GET /subscriptions] DID ${did}: metadata service does not exist on the DDO`)
        throw new BadRequestException(`${did} does not contain an 'metadata' service`)
      } else {
        Logger.error(`[GET /subscriptions] ${did}: error getting the metadata service from the DDO`)
        throw e
      }
    }
    if (metadataService.attributes.main.type !== 'service') {
      Logger.debug(
        `[GET /subscriptions] DID ${did} DDO has type ${metadataService.attributes.main.type}: should be service`,
      )
      throw new BadRequestException(
        `${did} DDO has type ${metadataService.attributes.main.type}: should be service`,
      )
    }

    // get the nft-access service
    let nftAccessService: Service<'nft-access'>
    try {
      nftAccessService = ddo.findServiceByType('nft-access')
    } catch (e) {
      if (e instanceof DDOError) {
        Logger.debug(
          `[GET /subscriptions] DID ${did}: nft-access service does not exist on the DDO`,
        )
        throw new BadRequestException(`${did} does not contain an 'nft-access' service`)
      } else {
        Logger.error(
          `[GET /subscriptions] ${did}: error getting the nft-access service from the DDO`,
        )
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
    // load the contract
    let nft: NFT721Api
    try {
      nft = await this.nvmService.nevermined.contracts.loadNft721(contractAddress)
    } catch (e) {
      Logger.debug(`failed to loadNft721 for contract '${contractAddress}': ${e}`)
      throw new BadRequestException(`Failed to load contract with address '${contractAddress}'`)
    }

    const balance = await nft.balanceOf(userAddress)

    return balance.toNumber() >= numberNfts
  }

  /**
   * Generates a JWT token for a web services subscription
   *
   * @param did - The did of the web services ddo with an associated subscription
   * @param userAddress - The ethereum address of the user requesting the JWT token
   * @param endpoints - The web service endpoints provided with the subscription
   * @param expiryTime - The expiry time for the JWT token. Set as the time left in the subscription or 2 years for unlimited subscriptions
   * @param headers - The headers that should be passed when calling the endpoints
   *
   * @returns {@link Promise<string>} The base64 encoded JWT Token
   */
  public async generateToken(
    did: string,
    userAddress: string,
    endpoints: any,
    expiryTime: number | string,
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
      .setExpirationTime(expiryTime)
      .encrypt(this.jwtSecret)
  }

  /**
   * Get the expiration time for a subscription.
   * The expiration time is generated in string format using common abbreviations:
   * `seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y`
   *
   * @param contractAddress - The NFT-721 contract address of the subscription
   * @param userAddress - The address of the user requesting a JWT token
   *
   * @throws {@link ForbiddenException}
   * @returns {@link Promise<string>} The expiration time
   */
  public async getExpirationTime(contractAddress: string, userAddress: string): Promise<string> {
    // get subscription DDO
    const subscriptionDdo = await this.getSubscriptionDdo(contractAddress)
    // get duration
    const duration = await this.nvmService.getDuration(subscriptionDdo)

    // if duration is unlimited
    if (duration === 0) {
      return this.defaultExpiryTime
    }

    // get nft transfer block number
    const subscriptionTransferBlockNumber =
      await this.nvmService.getSubscriptionTransferBlockNumber(subscriptionDdo.id, userAddress)

    // get current block number
    const currentBlockNumber = await this.nvmService.nevermined.web3.getBlockNumber()

    // blocks left in the subscription
    const subscriptionBlocksLeft = subscriptionTransferBlockNumber + duration - currentBlockNumber
    if (subscriptionBlocksLeft <= 0) {
      throw new ForbiddenException(
        `Subscription with contract address ${contractAddress} for user ${userAddress} is expired.`,
      )
    }

    // calculate the number of seconds left in the subscription
    const expiryTime = Math.floor((subscriptionBlocksLeft * this.averageBlockTime) / 1000)
    return `${expiryTime} secs`
  }

  /**
   * Get the subscription DDO
   *
   * @param contractAddress - The NFT-721 contract address for the subscription
   *
   * @throws {@link BadRequestException}
   * @returns {@link Promise<DDO>} The DDO for the subscription
   */
  private async getSubscriptionDdo(contractAddress: string): Promise<DDO> {
    // retrieve the subscription DDO
    const result = await this.nvmService.nevermined.search.bySubscriptionContractAddress(
      contractAddress,
    )
    const ddo = result.results.pop()
    if (!ddo) {
      throw new BadRequestException(
        `Subscription DDO for contract address ${contractAddress} not found.`,
      )
    }

    return ddo
  }
}
