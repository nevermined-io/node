import { Injectable } from '@nestjs/common'
import {
  generateId,
  generateIntantiableConfigFromConfig,
  didZeroX,
  DDO,
  MetaDataMain,
  Nevermined,
} from '@nevermined-io/sdk'
import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common'
import AWS from 'aws-sdk'
import { default as FormData } from 'form-data'
import { Logger } from '../logger/logger.service'
import { ConfigService } from '../config/config.service'
import { decrypt, Dtp, aes_decryption_256 } from '@nevermined-io/sdk-dtp'
import { ethers } from 'ethers'
import { HttpModuleOptions, HttpService } from '@nestjs/axios'
import { firstValueFrom } from 'rxjs'
import { AxiosError } from 'axios'
import IpfsHttpClientLite from 'ipfs-http-client-lite'
import { UploadBackends } from 'src/access/access.controller'

export enum AssetResult {
  DATA = 'data',
  DECRYPTED = 'decrypted',
  URL = 'url',
}

@Injectable()
export class NeverminedService {
  nevermined: Nevermined
  dtp: Dtp
  constructor(private config: ConfigService, private readonly httpService: HttpService) {}
  // TODO: handle configuration properly
  async onModuleInit() {
    const config = this.config.nvm()
    const web3 = new ethers.providers.JsonRpcProvider(config.web3ProviderUri)
    try {
      await web3.getNetwork()
    } catch (e) {
      throw new Error(`Invalid web3 provider for uri: ${config.web3ProviderUri}`)
    }
    this.nevermined = await Nevermined.getInstance(config)
    const instanceConfig = {
      ...generateIntantiableConfigFromConfig(config),
      nevermined: this.nevermined,
    }
    this.dtp = await Dtp.getInstance(instanceConfig, this.config.cryptoConfig())
  }
  getNevermined() {
    return this.nevermined
  }
  getDtp() {
    return this.dtp
  }
  instanceConfig() {
    const instanceConfig = {
      ...generateIntantiableConfigFromConfig(this.config.nvm()),
      nevermined: this.nevermined,
    }
    return instanceConfig
  }
  web3ProviderUri(): string {
    return this.config.nvm().web3ProviderUri
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
      throw new BadRequestException(`No such DID ${did}`)
    }
    const service = asset.findServiceByType('metadata')
    const file_attributes = service.attributes.main.files[index]
    const content_type = file_attributes.contentType
    const name = file_attributes.name
    const auth_method = asset.findServiceByType('authorization').service || 'RSAES-OAEP'
    if (auth_method === 'RSAES-OAEP') {
      const filelist = this.decrypt(service.attributes.encryptedFiles, 'PSK-RSA')

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
            ethers.utils.hexZeroPad('0x0', 32),
            'download',
            from,
          )
          Logger.debug(`Provenance: USED event Id (${provId}) for DID ${did} registered`)
        }
      } catch (error) {
        Logger.warn(`Unable to register on-chain provenance: ${error.toString()}`)
      }

      res.set({
        'Content-Type': content_type,
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
}
