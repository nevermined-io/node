import { HttpModuleOptions, HttpService } from '@nestjs/axios'
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common'
import {
  DDO,
  DDOError,
  DDOServiceNotFoundError,
  EventOptions,
  InstantiableConfig,
  MetaDataExternalResource,
  MetaDataMain,
  Nevermined,
  NvmAccount,
  ReducedProfile,
  Service,
  ServiceCommon,
  ServiceType,
  didZeroX,
  generateId,
  generateInstantiableConfigFromConfig,
} from '@nevermined-io/sdk'
import { createEcdsaKernelAccountClient } from '@zerodev/presets/zerodev'
import { KernelSmartAccount } from '@zerodev/sdk'
import AWS from 'aws-sdk'
import { AxiosError } from 'axios'
import { ethers } from 'ethers'
import { default as FormData } from 'form-data'
import IpfsHttpClientLite from 'ipfs-http-client-lite'
import { firstValueFrom } from 'rxjs'
import { UploadBackends } from 'src/access/access.controller'
import { createPublicClient, http, pad } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { aes_decryption_256, decrypt } from '../../common/helpers/encryption.helper'
import { ConfigService } from '../config/config.service'

export enum AssetResult {
  DATA = 'data',
  DECRYPTED = 'decrypted',
  URL = 'url',
}

@Injectable()
export class NeverminedService {
  nevermined: Nevermined
  zerodevSigner: KernelSmartAccount
  nodeAccount: NvmAccount
  public providerAddress: string

  constructor(
    private config: ConfigService,
    private readonly httpService: HttpService,
  ) {}
  // TODO: handle configuration properly
  async onModuleInit() {
    const config = this.config.nvm()
    Logger.debug(
      `Starting NeverminedService with config:\n${JSON.stringify(
        config,
        (k, v) => {
          return typeof v === 'undefined' ? null : v
        },
        2,
      )}`,
    )

    const web3 = createPublicClient({ transport: http(config.web3ProviderUri) })
    try {
      await web3.getChainId()
    } catch (e) {
      Logger.error(e)
      throw new Error(`Invalid web3 provider for uri: ${config.web3ProviderUri}`)
    }

    this.nevermined = await Nevermined.getInstance(config)

    // setup zerodev
    this.zerodevSigner = await this.setupZerodev()
    this.nodeAccount = await NvmAccount.fromZeroDevSigner(this.zerodevSigner)
    // set provider address
    if (this.zerodevSigner) {
      this.providerAddress = this.zerodevSigner.address
    } else {
      const [provider] = await this.nevermined.accounts.list()
      this.providerAddress = provider.getId()
    }
  }

  getNevermined() {
    return this.nevermined
  }

  instanceConfig(): InstantiableConfig {
    const instanceConfig = {
      ...generateInstantiableConfigFromConfig(this.config.nvm()),
      nevermined: this.nevermined,
    }
    return instanceConfig
  }

  web3ProviderUri(): string {
    return this.config.nvm().web3ProviderUri
  }

  private async setupZerodev(): Promise<KernelSmartAccount> {
    const projectId = this.config.cryptoConfig().zerodevProjectId
    if (projectId && projectId !== '') {
      const keyfile = this.config.cryptoConfig().provider_key
      const providerAccount = ethers.Wallet.fromEncryptedJsonSync(
        keyfile,
        this.config.cryptoConfig().provider_password,
      )

      const signer = privateKeyToAccount(providerAccount.privateKey as `0x${string}`)

      const kernelClient = await createEcdsaKernelAccountClient({
        projectId: projectId,
        signer,
      })
      // const zerodevProvider = await ZeroDevEthersProvider.init('ECDSA', {
      //   projectId,
      //   owner: convertEthersV6SignerToAccountSigner(providerAccount),
      // })

      return kernelClient.account
    }
  }

  async getAssetUrl(
    did: string,
    index: number,
  ): Promise<{ url: string; content_type: string; dtp: boolean; name?: string }> {
    // get url for DID
    let asset: DDO
    try {
      asset = await this.nevermined.assets.resolve(did)
    } catch (e) {
      Logger.error(`Cannot resolve DID ${did}`)
      Logger.error(e)
      throw new BadRequestException(`No such DID ${did}`)
    }
    const service = asset.findServiceByType('metadata')
    const file_attributes = service.attributes.main.files[index]
    const content_type = file_attributes.contentType
    const name = file_attributes.name
    const auth_method = asset.findServiceByType('authorization').service || 'RSAES-OAEP'
    if (auth_method === 'RSAES-OAEP') {
      const filelist: MetaDataExternalResource = await this.decrypt(
        service.attributes.encryptedFiles,
        'PSK-RSA',
      )

      // download url or what?
      const url: string = filelist[index].url
      return { url, content_type, dtp: this.isDTP(service.attributes.main), name }
    }
    Logger.error(`Auth METHOD wasn't RSAES-OAEP`)
    throw new BadRequestException()
  }

  /**
   * Decrypts a an encrypted JSON object
   *
   * @param encryptedJson - The encrypted json object as a string
   * @param encryptionMethod - The encryption method used. Currently only PSK-RSA is supported
   *
   * @returns The decrypted JSON object
   */
  async decrypt(encryptedJson: string, encryptionMethod: string): Promise<any> {
    return JSON.parse(await decrypt(this.config.cryptoConfig(), encryptedJson, encryptionMethod))
  }

  async downloadAsset(
    did: string,
    index: number,
    res: any,
    userAddress: string,
    result: AssetResult = AssetResult.DATA,
  ): Promise<StreamableFile | string> {
    Logger.debug(`Downloading asset from ${did} index ${index}`)
    try {
      // eslint-disable-next-line prefer-const
      let { url, content_type, dtp, name } = await this.getAssetUrl(did, index)
      if (!url) {
        Logger.error(`URL for did ${did} not found`)
        throw new NotFoundException(`URL for did ${did} not found`)
      }
      if (result === AssetResult.URL) {
        return url
      }
      if (dtp && !url.startsWith('cid://') && !url.startsWith('http')) {
        Logger.error(`password should be returned as URL ${url}`)
        throw new BadRequestException(`URL for did ${did} not found`)
      }
      Logger.debug(`Serving URL ${url}`)

      // If filename is on the ddo we will use that by default
      let filename: string
      if (name) {
        filename = name
      } else {
        const param = url.split('/').slice(-1)[0]
        filename = param.split('?')[0]
      }

      let response

      // Download from filecoin or ipfs
      if (url.startsWith('cid://')) {
        const ipfsProjectId = this.config.get<string>('IPFS_PROJECT_ID')
        const ipfsProjectSecret = this.config.get<string>('IPFS_PROJECT_SECRET')

        const cid = url.replace('cid://', '')
        Logger.debug('Getting', `${this.config.get<string>('IPFS_GATEWAY')}/api/v0/cat`)

        const config: HttpModuleOptions = {
          url: `${this.config.get<string>('IPFS_GATEWAY')}/api/v0/cat`,
          method: 'POST',
          responseType: 'arraybuffer',
          auth: {
            username: ipfsProjectId,
            password: ipfsProjectSecret,
          },
          params: {
            arg: cid,
          },
        }

        response = await firstValueFrom(this.httpService.request(config))

        // S3 compatible storage
      } else if (url.startsWith('s3://')) {
        const s3Url = new URL(url)
        const bucketName = s3Url.host
        const filePath = s3Url.pathname.substring(1)

        const s3 = new AWS.S3({
          accessKeyId: this.config.get('AWS_S3_ACCESS_KEY_ID'),
          secretAccessKey: this.config.get('AWS_S3_SECRET_ACCESS_KEY'),
          endpoint: this.config.get('AWS_S3_ENDPOINT'),
          region: 'auto',
        })

        const bucketOptions = {
          Bucket: bucketName,
          Key: filePath,
        }
        const fileObject = await s3.getObject(bucketOptions).promise()
        response = {
          data: fileObject.Body,
        }
      } else {
        const config: HttpModuleOptions = {
          responseType: 'arraybuffer',
        }
        response = await firstValueFrom(this.httpService.get(url, config))
      }

      let contents: Buffer = response.data

      if (index != 0) {
        const { url, dtp } = await this.getAssetUrl(did, 0)
        if (dtp && result === AssetResult.DECRYPTED) {
          const password = Buffer.from(url, 'hex')
          contents = Buffer.from(
            aes_decryption_256(contents.toString('binary'), password),
            'binary',
          )
        }
      }

      try {
        if (this.config.get<boolean>('ENABLE_PROVENANCE')) {
          const [from] = await this.nevermined.accounts.list()
          const provId = generateId()
          await this.nevermined.provenance.used(
            provId,
            didZeroX(did),
            userAddress,
            generateId(),
            pad('0x', { size: 32 }),
            `download file ${index}`,
            from,
          )
          Logger.debug(`Provenance: USED event Id (${provId}) for DID ${did} registered`)
        }
      } catch (error) {
        Logger.warn(`Unable to register on-chain provenance: ${error.toString()}`)
      }

      res.set({
        'Content-Type': content_type,
        'Access-Control-Expose-Headers': 'Content-Disposition',
        'Content-Disposition': `attachment;filename=${filename}`,
      })
      return new StreamableFile(contents)
    } catch (e) {
      if (e instanceof NotFoundException) {
        Logger.error(e)
        throw e
      } else {
        Logger.error(e)
        throw new InternalServerErrorException(e.toString())
      }
    }
  }

  public async checkBucketExists(bucketName: string, s3: AWS.S3): Promise<boolean> {
    const options = {
      Bucket: bucketName,
    }
    Logger.debug(`Checking if bucket ${bucketName} exists on S3`)
    try {
      await s3.headBucket(options).promise()
      Logger.debug(`Bucket ${bucketName} exists on S3`)
      return true
    } catch (error) {
      if (error.statusCode === 404) {
        Logger.debug(`Bucket ${bucketName} does NOT exists on S3`)
        return false
      }
      Logger.error(`Error checking if bucket ${bucketName} exists on S3: ${error}`)
      throw error
    }
  }

  public async createBucket(bucketName: string, s3: AWS.S3): Promise<boolean> {
    const options = {
      Bucket: bucketName,
    }

    Logger.debug(`Creating ${bucketName} on S3`)
    try {
      await s3.createBucket(options).promise()
      Logger.debug(`Bucket  ${bucketName} created correctly on S3`)
      return true
    } catch (error) {
      Logger.error(`Error creating Bucket ${bucketName} on S3`)
      throw error
    }
  }

  async uploadS3(file: Buffer, filename: string): Promise<string> {
    Logger.debug(`Uploading to S3 ${filename}`)
    filename = filename || 'data'
    const bucketName: string = this.config.get('AWS_S3_BUCKET_NAME')
    try {
      const s3 = new AWS.S3({
        accessKeyId: this.config.get('AWS_S3_ACCESS_KEY_ID'),
        secretAccessKey: this.config.get('AWS_S3_SECRET_ACCESS_KEY'),
        endpoint: this.config.get('AWS_S3_ENDPOINT'),
        s3ForcePathStyle: true,
        signatureVersion: 'v4',
      })
      const bucketExists = await this.checkBucketExists(bucketName, s3)
      if (!bucketExists) {
        await this.createBucket(bucketName, s3)
      }
      await s3
        .upload({
          Bucket: bucketName,
          Key: filename,
          Body: file,
        })
        .promise()
      const url = s3.getSignedUrl('getObject', {
        Bucket: bucketName,
        Key: filename,
        Expires: 3600 * 24,
      })
      return url
    } catch (e) {
      Logger.error(`Uploading ${filename}: AWS error ${e.response}`)
      throw new InternalServerErrorException(e)
    }
  }

  async uploadFilecoin(file: Buffer, filename: string): Promise<string> {
    try {
      Logger.debug(`Uploading to filecoin ${filename}`)

      const formData = new FormData()
      formData.append('data', file, filename)
      formData.append('filename', filename)

      const url = new URL('/content/add', this.config.get('ESTUARY_ENDPOINT'))
      const config: HttpModuleOptions = {
        url: url.toString(),
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.get('ESTUARY_TOKEN')}`,
          'Content-Type': formData.getHeaders()['content-type'],
        },
        data: formData,
      }

      const response = await firstValueFrom(this.httpService.request(config))
      const obj = response.data

      if (obj.error) {
        Logger.error('Estuary returned an error message:', obj.error)
        throw new InternalServerErrorException(obj.error)
      }

      return `cid://${obj.cid}`
    } catch (e) {
      if (e instanceof AxiosError) {
        Logger.error('Axios Error: ', e.response)
        throw new InternalServerErrorException('There was a problem uploading file to filecoin')
      } else {
        Logger.error(`Uploading ${filename}: Filecoin error ${e}`)
        throw new InternalServerErrorException(e)
      }
    }
  }

  async uploadIPFS(content: Buffer, filename: string): Promise<string> {
    try {
      Logger.debug(`Uploading to IPFS ${filename}`)
      const ipfsAuthToken = this.getIPFSAuthToken()

      const ipfs = IpfsHttpClientLite({
        apiUrl: this.config.get('IPFS_GATEWAY'),
        ...(ipfsAuthToken && {
          headers: { Authorization: `Basic ${ipfsAuthToken}` },
        }),
      })
      const addResult = await ipfs.add(content)
      return `cid://${addResult[0].hash}`
    } catch (e) {
      Logger.error(`Uploading ${filename}: IPFS error ${e}`)
      throw new InternalServerErrorException(e)
    }
  }

  async uploadToBackend(backend: UploadBackends, data: Buffer, fileName: string): Promise<string> {
    if (backend === 's3') {
      return await this.uploadS3(data, fileName)
    } else if (backend === 'filecoin') {
      return await this.uploadFilecoin(data, fileName)
    } else if (backend === 'ipfs') {
      return await this.uploadIPFS(data, fileName)
    }
  }

  private getIPFSAuthToken(): string | undefined {
    if (!this.config.get('IPFS_PROJECT_ID') || !this.config.get('IPFS_PROJECT_SECRET')) {
      Logger.warn(`Infura IPFS_PROJECT_ID or IPFS_PROJECT_SECRET are not set - disabling ipfs auth`)
      return undefined
    } else {
      return Buffer.from(
        `${this.config.get('IPFS_PROJECT_ID')}:${this.config.get('IPFS_PROJECT_SECRET')}`,
      ).toString('base64')
    }
  }

  private isDTP(main: MetaDataMain): boolean {
    return main.files && main.files.some((f) => f.encryption === 'dtp')
  }

  /**
   * Get the duration of the subscription in number of blocks
   *
   * @param subscriptionDDO - The DDO of the subscription
   * @param serviceReference - The service reference to fetch the duration from. Usually 'nft-sales' and 'nft-sales-proof'
   *
   * @throws {@link BadRequestException}
   * @returns {@link Promise<number>} The duration in number of blocks
   */
  public async getDuration(
    subscriptionDDO: DDO,
    serviceReference: number | ServiceType = 'nft-sales',
  ): Promise<number> {
    // get the nft-sales service
    let nftSalesService: Service
    try {
      nftSalesService = subscriptionDDO.findServiceByReference(serviceReference)
    } catch (e) {
      if (e instanceof DDOServiceNotFoundError) {
        throw new BadRequestException(
          `${subscriptionDDO.id} does not contain an '${serviceReference}' service`,
        )
      } else {
        throw e
      }
    }

    // get the duration parameter from the transferNFT condition
    const duration = DDO.getParameterFromCondition(nftSalesService, 'transferNFT', '_duration')
    // non-subscription nfts have no expiration
    return Number(duration) || 0
  }

  public getAssetPrice(service: ServiceCommon): bigint {
    const assetPrice = DDO.getAssetPriceFromService(service)

    if (assetPrice) return assetPrice.getTotalPrice()
    throw new DDOError(`No price found for asset ${service.index}`)
  }

  /**
   * Get the block number when a user bought the subscription
   *
   * @param subscriptionDid - The DID of the asset with associated subscription
   * @param userAddress - The address of the user that bough the subscription
   * @param ercType - The type of the NFT subscription
   * @returns {@link Promise<number>} The block number the user bought the subscription
   */
  public async getSubscriptionTransferBlockNumber(
    subscriptionDid: string,
    userAddress: string,
    ercType: number,
  ): Promise<number> {
    const eventOptions: EventOptions = {
      eventName: 'Fulfilled',
      filterSubgraph: {
        where: {
          _did: didZeroX(subscriptionDid),
          _receiver: userAddress,
        },
      },
      filterJsonRpc: {
        _did: didZeroX(subscriptionDid),
        _receiver: userAddress,
      },
      result: {
        id: true,
        _agreementId: true,
        _did: true,
        _receiver: true,
        blockNumber: true,
      },
    }
    const transferCondition =
      ercType === 721
        ? this.nevermined.keeper.conditions.transferNft721Condition
        : this.nevermined.keeper.conditions.transferNftCondition
    const [event] = await transferCondition.events.getPastEvents(eventOptions)

    if (!event) {
      throw new ForbiddenException(
        `No purchase found for subscription ${subscriptionDid} from user ${userAddress}`,
      )
    }

    return Number(event.blockNumber)
  }

  /**
   * It gets the user profile information from the marketplace api given the user address
   * @param address user address
   * @returns {@link Promise<Profile>}
   */
  async getUserProfileFromAddress(address: string): Promise<ReducedProfile> {
    try {
      return this.nevermined.services.profiles.findOneByAddress(address)
    } catch (e) {
      Logger.warn(`Cannot find the user profile with address ${address}`)
      throw new NotFoundException(`Profile with address ${address} not found`)
    }
  }
}
