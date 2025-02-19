import { Injectable, Logger } from '@nestjs/common'
import { InternalServerErrorException } from '@nestjs/common'
import { ConfigService } from '../config/config.service'
import { firstValueFrom } from 'rxjs'
import { HttpModuleOptions, HttpService } from '@nestjs/axios'
import { NvmApiKey } from '@nevermined-io/sdk'

export interface AssetTransaction {
  assetDid: string
  assetOwner: string
  assetConsumer: string
  txType: string
  price: string
  currency: string
  paymentType: string
  txHash?: string
  metadata?: string
}

export interface UserNotification {
  notificationType: 'SubscriptionReceived' | 'SubscriptionPurchased' | 'Other'
  receiver: string
  originator: 'Nevermined' | 'Other'
  readStatus: 'Pending' | 'Other'
  deliveryStatus: 'Pending' | 'Other'
  title: string
  body: string
  link: string
  did?: string
}

@Injectable()
export class BackendService {
  isNVMBackendEnabled = false
  trackBackendTxs: boolean
  backendUrl: string
  backendAuth: string
  appUrl: string

  constructor(
    private config: ConfigService,
    private readonly httpService: HttpService,
  ) {}

  async onModuleInit() {
    Logger.debug(`Starting BackendService`)

    try {
      this.trackBackendTxs = this.config.backendConfig().trackBackendTxs
      this.backendUrl = this.config.backendConfig().backendUrl
      this.backendAuth = this.config.backendConfig().backendAuth
      this.isNVMBackendEnabled = this.config.backendConfig().isNVMBackendEnabled
      this.appUrl = this.config.backendConfig().appUrl

      Logger.log(`Backend Config: `)
      Logger.log(`Is Backend Enabled: ${this.isNVMBackendEnabled}`)
      Logger.log(this.trackBackendTxs)
      Logger.log(this.backendUrl)
      Logger.log(this.backendAuth)
    } catch (e) {
      Logger.warn(e)
    }
  }

  public isBackendEnabled(): boolean {
    return this.isNVMBackendEnabled
  }

  public async recordAssetTransaction(assetTx: AssetTransaction): Promise<boolean> {
    if (!this.isNVMBackendEnabled || !this.trackBackendTxs) {
      Logger.warn('Backend transactions recording is disabled by config')
      return false
    }

    const requestConfig: HttpModuleOptions = {
      url: `${this.backendUrl}/api/v1/transactions/asset`,
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.backendAuth}`,
        'Content-Type': 'application/json',
      },
      data: assetTx,
    }

    const response = await firstValueFrom(this.httpService.request(requestConfig))
    const obj = response.data

    if (obj.error) {
      Logger.error('Backend returned an error message:', obj.error)
      throw new InternalServerErrorException(obj.error)
    }

    return true
  }

  public async sendMintingNotification(userNotification: UserNotification): Promise<boolean> {
    if (!this.isNVMBackendEnabled) {
      Logger.warn('Backend is disabled by config')
      return false
    }

    const requestConfig: HttpModuleOptions = {
      url: `${this.backendUrl}/api/v1/notifications/notification`,
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.backendAuth}`,
        'Content-Type': 'application/json',
      },
      data: userNotification,
    }

    const response = await firstValueFrom(this.httpService.request(requestConfig))
    const obj = response.data

    if (obj.error) {
      Logger.error('Backend returned an error message:', obj.error)
      throw new InternalServerErrorException(obj.error)
    }

    return true
  }

  public async validateApiKey(apiKeyHash: string): Promise<NvmApiKey> {
    if (!this.isNVMBackendEnabled) {
      Logger.warn('Backend is disabled by config')
      throw new InternalServerErrorException('Backend is disabled by config')
    }

    const requestConfig: HttpModuleOptions = {
      url: `${this.backendUrl}/api/v1/api-keys/validate`,
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKeyHash}`,
        'Content-Type': 'application/json',
      },
    }

    const response = await firstValueFrom(this.httpService.request(requestConfig))
    const obj = response.data

    if (obj.error) {
      Logger.error('Backend returned an error message:', obj.error)
      throw new InternalServerErrorException(obj.error)
    }

    return obj
  }
}
