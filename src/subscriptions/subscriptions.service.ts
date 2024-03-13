import { BadRequestException, ForbiddenException, Injectable, Logger } from '@nestjs/common'
import {
  ChargeType,
  DDO,
  DDOError,
  DID,
  NFT1155Api,
  NFT721Api,
  NeverminedNFT1155Type,
  NeverminedNFT721Type,
  Service,
  SubscriptionType,
  ZeroAddress,
  didPrefixed,
} from '@nevermined-io/sdk'
import { NeverminedService } from '../shared/nevermined/nvm.service'
import * as jose from 'jose'
import { ConfigService } from '../shared/config/config.service'

export interface SubscriptionData {
  numberNfts: number
  contractAddress: string
  endpoints: string[]
  headers: { [key: string]: string }[]
  owner: string
  ercType: number
  tokenId?: string
  subscriptionType?: SubscriptionType
  chargeType?: ChargeType
  minCreditsRequired?: bigint
  minCreditsToCharge?: bigint
  maxCreditsToCharge?: bigint
}

@Injectable()
export class SubscriptionsService {
  private readonly jwtSecret: Uint8Array
  public readonly neverminedProxyUri: string
  public readonly defaultExpiryTime: string
  private readonly averageBlockTime: number

  constructor(
    private nvmService: NeverminedService,
    private config: ConfigService,
  ) {
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
  public async validateServiceDid(did: string): Promise<SubscriptionData> {
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
      Logger.error(e)
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

    let numberNfts, contractAddress, tokenId: string
    try {
      numberNfts = Number(DDO.getNftAmountFromService(nftAccessService))
      contractAddress = DDO.getNftContractAddressFromService(nftAccessService)
      tokenId = DDO.getTokenIdFromService(nftAccessService)

      Logger.log(`Token Id obtained from nft-access service: ${tokenId} - ${didPrefixed(tokenId)}`)
    } catch (e) {
      Logger.error(
        `[GET /subscriptions] ${did}: getting numberNfts, contractAddress, tokenId from nft-access service`,
      )
      throw e
    }

    let subscriptionType = SubscriptionType.Time
    let chargeType = ChargeType.Fixed

    let minCreditsRequired = 1n
    let minCreditsToCharge = 1n
    let maxCreditsToCharge = 1n
    try {
      const subscriptionDDO = await this.nvmService.nevermined.assets.resolve(didPrefixed(tokenId))
      const subscriptionMetadata = subscriptionDDO.findServiceByType('metadata')

      subscriptionType = subscriptionMetadata.attributes.main.subscription?.subscriptionType
      if (subscriptionType === SubscriptionType.Credits) {
        minCreditsRequired = nftAccessService.attributes.main.nftAttributes?.minCreditsRequired
          ? nftAccessService.attributes.main.nftAttributes?.minCreditsRequired
          : 1n
        minCreditsToCharge = nftAccessService.attributes.main.nftAttributes?.minCreditsToCharge
          ? nftAccessService.attributes.main.nftAttributes?.minCreditsToCharge
          : 1n
        maxCreditsToCharge = nftAccessService.attributes.main.nftAttributes?.maxCreditsToCharge
          ? nftAccessService.attributes.main.nftAttributes?.maxCreditsToCharge
          : 1n
        chargeType = subscriptionMetadata.attributes.main.webService?.chargeType
          ? subscriptionMetadata.attributes.main.webService?.chargeType
          : ChargeType.Fixed
      }
    } catch (e) {
      Logger.error(
        `[GET /subscriptions] ${did}: error getting subscriptionType from subscription DDO - tokenId: ${tokenId}`,
      )
      throw e
    }

    // get the web-service endpoints
    const ercType = metadataService.attributes.main.ercType
    const endpoints = metadataService.attributes.main.webService.endpoints.flatMap((e) =>
      Object.values(e),
    )

    // decrypt the headers
    const headers = await this.nvmService.decrypt(
      metadataService.attributes.main.webService.encryptedAttributes,
      'PSK-RSA',
    )

    Logger.debug(
      `DIDRegistry: ${await this.nvmService.nevermined.keeper.didRegistry.contract.getAddress()}`,
    )

    // get the owner of the DID
    let owner = await this.nvmService.nevermined.keeper.didRegistry.getDIDOwner(did)
    if (owner === ZeroAddress) {
      Logger.debug(
        `Owner not found on-chain, probably asset was registered off-chain. Getting owner from DDO.`,
      )
      owner = ddo.proof?.creator || ddo.publicKey[0].owner
    }

    // const didAttributes = await this.nvmService.nevermined.keeper.didRegistry.getAttributesByDid(did)
    // const owner = didAttributes['owner']
    // Logger.debug(`DID Attributes: ${JSON.stringify(didAttributes)}`)
    Logger.debug(`Getting DID Owner: ${owner} for DID: ${did}`)
    return {
      numberNfts,
      contractAddress,
      endpoints,
      headers,
      owner,
      ercType,
      tokenId,
      subscriptionType,
      chargeType,
      minCreditsRequired,
      minCreditsToCharge,
      maxCreditsToCharge,
    }
  }

  /**
   * Validates if a subscription is valid or not
   *
   * @param contractAddress - The NFT-721 contract address
   * @param ercType - The type of the NFT contract (1155 or 721)
   * @param numberNfts - Amount of `contractAddress` nfts a user needs to hold in order to get access to the subscription
   * @param userAddress - The ethereum address of the user
   * @param tokenId - The NFT-1155 token id (DID)
   *
   * @returns {@link boolean}
   */
  public async isSubscriptionValid(
    contractAddress: string,
    ercType: number,
    numberNfts: number,
    userAddress: string,
    tokenId?: string,
  ): Promise<boolean> {
    const balance =
      ercType === 721
        ? await this.getSubscriptionERC721Balance(contractAddress, userAddress)
        : await this.getSubscriptionERC1155Balance(contractAddress, tokenId, userAddress)

    numberNfts = numberNfts >= 1 ? numberNfts : 1 // The number of NFTs must be at least 1
    return Number(balance) >= numberNfts
  }

  private async getSubscriptionERC721Balance(
    contractAddress: string,
    userAddress: string,
  ): Promise<bigint> {
    let nft: NFT721Api
    try {
      nft = await this.nvmService.nevermined.contracts.loadNft721(contractAddress)
    } catch (e) {
      Logger.debug(`failed to loadNft721 for contract '${contractAddress}': ${e}`)
      throw new BadRequestException(`Failed to load contract with address '${contractAddress}'`)
    }

    return await nft.balanceOf(userAddress)
  }

  private async getSubscriptionERC1155Balance(
    contractAddress: string,
    tokenId: string,
    userAddress: string,
  ): Promise<bigint> {
    let nft: NFT1155Api
    try {
      nft = await this.nvmService.nevermined.contracts.loadNft1155(contractAddress)
    } catch (e) {
      Logger.debug(`failed to loadNft1155 for contract '${contractAddress}': ${e}`)
      throw new BadRequestException(`Failed to load contract with address '${contractAddress}'`)
    }

    return await nft.balance(tokenId, userAddress)
  }

  /**
   * Generates a JWT token for a web services subscription
   *
   * @param did - The did of the web services ddo with an associated subscription
   * @param tokenId - The tokenId representing the DID of the subscription
   * @param userAddress - The ethereum address of the user requesting the JWT token
   * @param endpoints - The web service endpoints provided with the subscription
   * @param expiryTime - The expiry time for the JWT token. Set as the time left in the subscription or 2 years for unlimited subscriptions
   * @param ercType - The NFT ERC type
   * @param headers - The headers that should be passed when calling the endpoints
   *
   * @returns {@link Promise<string>} The base64 encoded JWT Token
   */
  public async generateToken(
    did: string,
    tokenId: string,
    userAddress: string,
    endpoints: any,
    expiryTime: number | string,
    owner: string,
    ercType: number,
    headers?: any,
    subscriptionType?: SubscriptionType,
    chargeType?: ChargeType,
    minCreditsRequired?: bigint,
    minCreditsToCharge?: bigint,
    maxCreditsToCharge?: bigint,
  ): Promise<string> {
    return await new jose.EncryptJWT({
      did: did,
      subscriptionDid: tokenId,
      userId: userAddress,
      ercType,
      endpoints,
      headers,
      owner,
      subscriptionType,
      chargeType,
      minCreditsRequired,
      minCreditsToCharge,
      maxCreditsToCharge,
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
   * @param contractAddress - The NFT contract address of the subscription
   * @param userAddress - The address of the user requesting a JWT token
   * @param ercType - The type of NFT contract (1155 or 721)
   *
   * @throws {@link ForbiddenException}
   * @returns {@link Promise<string>} The expiration time
   */
  public async getExpirationTime(
    contractAddress: string,
    userAddress: string,
    ercType: number,
    tokenId?: string,
  ): Promise<string> {
    // get subscription DDO
    const subscriptionDdo =
      ercType === 1155
        ? await this.nvmService.nevermined.assets.resolve(`did:nv:${tokenId}`)
        : await this.getSubscriptionDdo(contractAddress, ercType)
    // get duration
    const duration = await this.nvmService.getDuration(subscriptionDdo)

    // if duration is unlimited
    if (duration === 0) {
      return this.defaultExpiryTime
    }

    // get nft transfer block number
    const subscriptionTransferBlockNumber =
      await this.nvmService.getSubscriptionTransferBlockNumber(
        subscriptionDdo.id,
        userAddress,
        ercType,
      )

    // get current block number
    const currentBlockNumber = await this.nvmService.nevermined.web3.getBlockNumber()

    // blocks left in the subscription
    const subscriptionBlocksLeft = subscriptionTransferBlockNumber + duration - currentBlockNumber
    if (subscriptionBlocksLeft <= 0) {
      throw new ForbiddenException(
        `Subscription with DID/TokenId ${tokenId} for user ${userAddress} is expired.`,
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
   * @param ercType - Type of erc contract
   *
   * @throws {@link BadRequestException}
   * @returns {@link Promise<DDO>} The DDO for the subscription
   */
  private async getSubscriptionDdo(contractAddress: string, ercType: number): Promise<DDO> {
    // retrieve the subscription DDO
    const result = await this.nvmService.nevermined.search.bySubscriptionContractAddress(
      contractAddress,
      ercType === 721
        ? NeverminedNFT721Type.nft721Subscription
        : NeverminedNFT1155Type.nft1155Credit,
    )
    const ddo = result.results.pop()
    if (!ddo) {
      throw new BadRequestException(
        `Subscription DDO for contract address ${contractAddress} and ercType ${ercType} not found.`,
      )
    }

    return ddo
  }
}
