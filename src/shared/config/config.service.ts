/* eslint @typescript-eslint/no-var-requires: 0 */
/* eslint @typescript-eslint/no-unsafe-assignment: 0 */
/* eslint @typescript-eslint/no-unsafe-argument: 0 */
import { Logger } from '@nestjs/common'
import { NeverminedOptions } from '@nevermined-io/sdk'
import { readFileSync } from 'fs'
import * as Joi from 'joi'
import { get as loGet } from 'lodash'

export interface EnvConfig {
  [key: string]: string
  nvm: any
}

export interface CryptoConfig {
  provider_key: string
  provider_password: string
  provider_rsa_public: string
  provider_rsa_private: string
}

export interface ComputeConfig {
  enable_compute: boolean
  argo_host: string
  argo_namespace: string
  argo_auth_token: string
  compute_provider_keyfile: string
  compute_provider_key: string
  compute_provider_password: string
}

export interface SubscriptionsConfig {
  jwtSecret: Uint8Array
  neverminedProxyUri: string
  defaultExpiryTime: string
  averageBlockTime: number
}

export interface BackendConfig {
  isNVMBackendEnabled: boolean
  trackBackendTxs: boolean
  backendUrl: string
  backendAuth: string
  appUrl: string
}

const configProfile = require('../../../config')

const DOTENV_SCHEMA = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test', 'staging')
    .default('development'),
  JWT_SECRET_KEY: Joi.string().required().error(new Error('JWT_SECRET_KEY is required!')),
  JWT_EXPIRY_KEY: Joi.string().default('60m'),
  JWT_SUBSCRIPTION_SECRET_KEY: Joi.string()
    .required()
    .error(new Error('JWT_SUBSCRIPTION_SECRET_KEY is required!')),
  // defaults to 2 years in seconds
  SUBSCRIPTION_DEFAULT_EXPIRY_TIME: Joi.string().default('100 years'),
  // Used to calculate expiry time of subscriptions in milliseconds
  NETWORK_AVERAGE_BLOCK_TIME: Joi.number().default(2100),
  server: Joi.object({
    port: Joi.number().default(8030),
  }),
  security: Joi.object({
    enableHttpsRedirect: Joi.bool().default(false),
  }).default({
    enableHttpsRedirect: false,
  }),
  nvm: Joi.any(),
  PROVIDER_KEYFILE: Joi.string().required().error(new Error('PROVIDER_KEYFILE is required!')),
  RSA_PRIVKEY_FILE: Joi.string().required().error(new Error('RSA_PRIVKEY_FILE is required!')),
  RSA_PUBKEY_FILE: Joi.string().required().error(new Error('RSA_PUBKEY_FILE is required!')),
  PROVIDER_BABYJUB_SECRET: Joi.string(),
  PROVIDER_BABYJUB_PUBLIC1: Joi.string(),
  PROVIDER_BABYJUB_PUBLIC2: Joi.string(),
  PROVIDER_PASSWORD: Joi.string(),
  ESTUARY_TOKEN: Joi.string(),
  ESTUARY_ENDPOINT: Joi.string(),
  IPFS_GATEWAY: Joi.string(),
  IPFS_PROJECT_ID: Joi.string(),
  IPFS_PROJECT_SECRET: Joi.string(),
  AWS_S3_ACCESS_KEY_ID: Joi.string().allow(''),
  AWS_S3_SECRET_ACCESS_KEY: Joi.string().allow(''),
  AWS_S3_ENDPOINT: Joi.string().allow(''),
  AWS_S3_BUCKET_NAME: Joi.string().allow(''),
  ENABLE_PROVENANCE: Joi.boolean().default(true),
  ARTIFACTS_FOLDER: Joi.string().default('./artifacts'),
  CIRCUITS_FOLDER: Joi.string().default('./circuits'),
  ENABLE_COMPUTE: Joi.boolean().default(false),
  ARGO_HOST: Joi.string().default('http:localhost:2746/'),
  ARGO_NAMESPACE: Joi.string().default('argo'),
  ARGO_AUTH_TOKEN: Joi.string(),
  COMPUTE_PROVIDER_KEYFILE: Joi.string(),
  COMPUTE_PROVIDER_PASSWORD: Joi.string(),
  NEVERMINED_PROXY_URI: Joi.string(),
  ZERODEV_PROJECT_ID: Joi.string().allow(''),
  NVM_BACKEND_URL: Joi.string().allow(''),
  NVM_BACKEND_AUTH: Joi.string(),
  TRACK_BACKEND_TXS: Joi.string(),
  NVM_APP_URL: Joi.string(),
})

type DotenvSchemaKeys =
  | 'NODE_ENV'
  | 'server.port'
  | 'database.url'
  | 'JWT_SECRET_KEY'
  | 'JWT_EXPIRY_KEY'
  | 'security.enableHttpsRedirect'
  | 'PROVIDER_KEYFILE'
  | 'RSA_PRIVKEY_FILE'
  | 'RSA_PUBKEY_FILE'
  | 'PROVIDER_BABYJUB_SECRET'
  | 'PROVIDER_BABYJUB_PUBLIC1'
  | 'PROVIDER_BABYJUB_PUBLIC2'
  | 'PROVIDER_PASSWORD'
  | 'ESTUARY_TOKEN'
  | 'ESTUARY_ENDPOINT'
  | 'IPFS_GATEWAY'
  | 'IPFS_PROJECT_ID'
  | 'IPFS_PROJECT_SECRET'
  | 'AWS_S3_ACCESS_KEY_ID'
  | 'AWS_S3_SECRET_ACCESS_KEY'
  | 'AWS_S3_ENDPOINT'
  | 'AWS_S3_BUCKET_NAME'
  | 'ENABLE_PROVENANCE'
  | 'ARTIFACTS_FOLDER'
  | 'CIRCUITS_FOLDER'
  | 'ENABLE_COMPUTE'
  | 'ARGO_HOST'
  | 'ARGO_NAMESPACE'
  | 'ARGO_AUTH_TOKEN'
  | 'COMPUTE_PROVIDER_KEYFILE'
  | 'COMPUTE_PROVIDER_PASSWORD'
  | 'JWT_SUBSCRIPTION_SECRET_KEY'
  | 'NEVERMINED_PROXY_URI'
  | 'SUBSCRIPTION_DEFAULT_EXPIRY_TIME'
  | 'NETWORK_AVERAGE_BLOCK_TIME'
  | 'ZERODEV_PROJECT_ID'
  | 'NVM_BACKEND_URL'
  | 'NVM_BACKEND_AUTH'
  | 'TRACK_BACKEND_TXS'
  | 'NVM_APP_URL'

export class ConfigService {
  private readonly envConfig: EnvConfig
  private readonly crypto: CryptoConfig
  private readonly compute: ComputeConfig
  private readonly subscriptions: SubscriptionsConfig
  private readonly backend: BackendConfig

  constructor() {
    this.envConfig = this.validateInput(configProfile)
    this.crypto = {
      provider_password: this.get('PROVIDER_PASSWORD') || '',
      provider_key: this.get('PROVIDER_KEYFILE') || '',
      provider_rsa_public: readFileSync(this.get('RSA_PUBKEY_FILE') || '').toString(),
      provider_rsa_private: readFileSync(this.get('RSA_PRIVKEY_FILE') || '').toString(),
    }
    this.compute = {
      enable_compute: this.get('ENABLE_COMPUTE') === 'true',
      argo_host: this.get('ARGO_HOST') || '',
      argo_namespace: this.get('ARGO_NAMESPACE') || '',
      argo_auth_token: this.get('ARGO_AUTH_TOKEN') || '',
      compute_provider_keyfile: this.get('COMPUTE_PROVIDER_KEYFILE') || '',
      compute_provider_key:
        (this.get('COMPUTE_PROVIDER_KEYFILE') || '') &&
        readFileSync(this.get('COMPUTE_PROVIDER_KEYFILE') || '').toString(),
      compute_provider_password: this.get('COMPUTE_PROVIDER_PASSWORD') || '',
    }

    this.subscriptions = {
      jwtSecret: Uint8Array.from(
        (this.get<string>('JWT_SUBSCRIPTION_SECRET_KEY') || '').split('').map((x) => parseInt(x)),
      ),
      neverminedProxyUri: this.get<string>('NEVERMINED_PROXY_URI') || '',
      defaultExpiryTime: this.get<string>('SUBSCRIPTION_DEFAULT_EXPIRY_TIME') || '',
      averageBlockTime: this.get<number>('NETWORK_AVERAGE_BLOCK_TIME') || 0,
    }
    this.backend = {
      isNVMBackendEnabled: this.get<string>('NVM_BACKEND_URL') !== '',
      trackBackendTxs: this.get<string>('TRACK_BACKEND_TXS') === 'true',
      backendUrl: this.get<string>('NVM_BACKEND_URL') || '',
      backendAuth: this.get<string>('NVM_BACKEND_AUTH') || '',
      appUrl: this.get<string>('NVM_APP_URL') || '',
    }
  }

  get<T>(path: DotenvSchemaKeys): T | undefined {
    return loGet(this.envConfig, path) as unknown as T | undefined
  }

  nvm(): NeverminedOptions {
    return this.envConfig.nvm
  }

  cryptoConfig(): CryptoConfig {
    return this.crypto
  }

  computeConfig(): ComputeConfig {
    return this.compute
  }

  subscriptionsConfig(): SubscriptionsConfig {
    return this.subscriptions
  }

  backendConfig(): BackendConfig {
    return this.backend
  }

  getProviderBabyjub() {
    return {
      x: this.envConfig.PROVIDER_BABYJUB_PUBLIC1 || '',
      y: this.envConfig.PROVIDER_BABYJUB_PUBLIC2 || '',
      secret: this.envConfig.PROVIDER_BABYJUB_SECRET || '',
    }
  }

  private validateInput(envConfig: EnvConfig): EnvConfig {
    const { error, value: validatedEnvConfig } = DOTENV_SCHEMA.validate(envConfig, {
      allowUnknown: true,
      stripUnknown: true,
    })
    if (error) {
      Logger.error('Missing configuration please provide followed variable!\n\n', 'ConfigService')
      Logger.error(error.message, 'ConfigService')
      process.exit(2)
    }
    return validatedEnvConfig as EnvConfig
  }
}
