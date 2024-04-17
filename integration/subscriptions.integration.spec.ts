import { INestApplication } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { JwtModule } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'
import { Test, TestingModule } from '@nestjs/testing'
import {
  AssetAttributes,
  ContractHandler,
  DDO,
  NFTAttributes,
  Nevermined,
  NvmAccount,
  NvmAppMetadata,
  SubscriptionCreditsNFTApi,
  SubscriptionNFTApi,
  didPrefixed,
  generateId,
} from '@nevermined-io/sdk'
import * as jose from 'jose'
import request from 'supertest'
import { AuthService } from '../src/auth/auth.service.mock'
import { JwtAuthGuard } from '../src/common/guards/auth/jwt-auth.guard'
import { JwtStrategy } from '../src/common/strategies/jwt.strategy'
import { ConfigModule } from '../src/shared/config/config.module'
import { NeverminedModule } from '../src/shared/nevermined/nvm.module'
import { SubscriptionsController } from '../src/subscriptions/subscriptions.controller'
import { SubscriptionsService } from '../src/subscriptions/subscriptions.service'

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { config } from './config'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { ConfigService } from '../src/shared/config/config.service'
import { NeverminedService } from '../src/shared/nevermined/nvm.service'
import { getMetadata } from './utils'

describe('SubscriptionsController', () => {
  let app: INestApplication
  let authService: AuthService
  let subscriptionsService: SubscriptionsService
  let neverminedService: NeverminedService
  let configService: ConfigService
  let bearerToken: string
  let nevermined: Nevermined

  beforeAll(async () => {
    // setting up the app
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [SubscriptionsController],
      providers: [SubscriptionsService, AuthService, JwtStrategy],
      imports: [
        NeverminedModule,
        ConfigModule,
        PassportModule,
        JwtModule.register({
          secret: 'secret',
          signOptions: { expiresIn: '60m' },
        }),
      ],
    }).compile()

    app = moduleRef.createNestApplication()
    authService = moduleRef.get<AuthService>(AuthService)
    subscriptionsService = moduleRef.get<SubscriptionsService>(SubscriptionsService)
    neverminedService = moduleRef.get<NeverminedService>(NeverminedService)
    configService = moduleRef.get<ConfigService>(ConfigService)
    app.useGlobalGuards(new JwtAuthGuard(new Reflector()))
    await app.init()

    // get valid access token
    bearerToken = await authService.createToken({})

    // get a nevermined instance
    nevermined = await Nevermined.getInstance(config)
    const [account] = nevermined.accounts.list()
    const clientAssertion = await nevermined.utils.jwt.generateClientAssertion(account)
    await nevermined.services.marketplace.login(clientAssertion)
  })

  describe('GET /subscriptions should only accept authenticated requests', () => {
    it('no bearer token', () => {
      return request(app.getHttpServer())
        .get(`/${didPrefixed(generateId())}`)
        .expect(401)
    })

    it('with valid bearer token', async () => {
      const response = await request(app.getHttpServer())
        .get(`/${didPrefixed(generateId())}`)
        .set('Authorization', `Bearer ${bearerToken}`)

      expect(response.statusCode).not.toEqual(401)
    })
  })

  describe('GET /subscriptions should only accept valid DIDs', () => {
    it('should not accept empty DIDs', async () => {
      const response = await request(app.getHttpServer())
        .get('/')
        .set('Authorization', `Bearer ${bearerToken}`)

      expect(response.statusCode).toEqual(404)
    })

    it('should not accept badly constructed DIDs', async () => {
      const response = await request(app.getHttpServer())
        .get('/badDID')
        .set('Authorization', `Bearer ${bearerToken}`)

      expect(response.statusCode).toEqual(400)
      expect(response.text).toMatch(/is not a valid DID/)
    })

    it('should not accept DIDs that cannot be resolved', async () => {
      const response = await request(app.getHttpServer())
        .get(`/${didPrefixed(generateId())}`)
        .set('Authorization', `Bearer ${bearerToken}`)

      expect(response.statusCode).toEqual(400)
      expect(response.text).toMatch(/not found/)
    })
  })

  describe('GET /subscriptions should only accept valid resolved DDOs', () => {
    let ddoWrongType: DDO
    let ddoNoNftAccess: DDO

    beforeAll(async () => {
      const [account] = nevermined.accounts.list()

      // no 'service' type
      let assetAttributes = AssetAttributes.getInstance({
        metadata: getMetadata(),
      })
      ddoWrongType = await nevermined.assets.create(assetAttributes, account)

      // no nft-access service
      const metadata = getMetadata()
      metadata.main.type = 'service'
      metadata.main.webService = {
        endpoints: [{ GET: 'https://example.com' }],
        internalAttributes: {
          authentication: {
            type: 'oauth',
          },
          headers: [{ Authorization: 'test' }],
        },
      }
      assetAttributes = AssetAttributes.getInstance({
        metadata: metadata,
      })
      ddoNoNftAccess = await nevermined.assets.create(assetAttributes, account)
    })

    it('should not allow DDOs of type != service', async () => {
      const response = await request(app.getHttpServer())
        .get(`/${ddoWrongType.id}`)
        .set('Authorization', `Bearer ${bearerToken}`)

      expect(response.statusCode).toEqual(400)
      expect(response.text).toMatch(/should be service/)
    })

    it('should not allow DDO without nft-access service', async () => {
      const response = await request(app.getHttpServer())
        .get(`/${ddoNoNftAccess.id}`)
        .set('Authorization', `Bearer ${bearerToken}`)

      expect(response.statusCode).toEqual(400)
      expect(response.text).toMatch(/does not contain an 'nft-access' service/)
    })
  })

  describe('GET /subscriptions should validate the subscription (721)', () => {
    let ddoWebService: DDO
    let ddoSubscription: DDO
    let notSubscriberToken: string
    let subscriberToken: string
    let subscriberAddress: string
    let ownerAddress: string
    let publisher: NvmAccount
    let subscriber: NvmAccount
    let notSubscriber: NvmAccount

    beforeAll(async () => {
      ;[publisher, subscriber, notSubscriber] = nevermined.accounts.list()
      subscriberAddress = subscriber.getId()
      ownerAddress = publisher.getId()

      const contractABI = await ContractHandler.getABIArtifact(
        'NFT721SubscriptionUpgradeable',
        './integration/resources/',
      )
      const subscriptionNFT = await SubscriptionNFTApi.deployInstance(
        config,
        contractABI,
        publisher,
        [
          publisher.getId(),
          nevermined.keeper.didRegistry.address,
          'Subscription Service NFT',
          '',
          '',
          0,
          nevermined.keeper.nvmConfig.address,
        ],
      )

      await nevermined.contracts.loadNft721Api(subscriptionNFT)
      await subscriptionNFT.grantOperatorRole(
        nevermined.keeper.conditions.transferNft721Condition.address,
        publisher,
      )

      const subscriptionMetadata = NvmAppMetadata.getTimeSubscriptionMetadataTemplate(
        'NVM App Time only Node Subscription test',
        'Nevermined',
        'hours',
      )
      // get the subscription ddo
      const nftAttributesSubscription = NFTAttributes.getSubscriptionInstance({
        metadata: subscriptionMetadata,
        services: [
          {
            serviceType: 'nft-sales',
            nft: { duration: 1000, nftTransfer: false, amount: 1n },
          },
        ],
        providers: config.neverminedNodeAddress ? [config.neverminedNodeAddress] : [],
        nftContractAddress: subscriptionNFT.address,
        preMint: false,
      })
      ddoSubscription = await nevermined.nfts721.create(nftAttributesSubscription, publisher)

      // ddo web service
      const serviceMetadata = getMetadata()
      serviceMetadata.main.type = 'service'
      serviceMetadata.main.webService = {
        endpoints: [{ GET: 'https://example.com' }],
        internalAttributes: {
          authentication: {
            type: 'oauth',
            token: 'xxx',
          },
          headers: [{ Authorization: 'Bearer test' }],
        },
      }
      const nftAttributesNoContractAddress = NFTAttributes.getNFT721Instance({
        metadata: serviceMetadata,
        services: [
          {
            serviceType: 'nft-access',
            nft: {
              tokenId: ddoSubscription.shortId(),
              nftTransfer: false,
            },
          },
        ],
        providers: config.neverminedNodeAddress ? [config.neverminedNodeAddress] : [],
        nftContractAddress: subscriptionNFT.address,
        preMint: false,
      })
      ddoWebService = await nevermined.nfts721.create(nftAttributesNoContractAddress, publisher)

      // not a subscriber bearer token
      notSubscriberToken = await authService.createToken({}, notSubscriber)

      // subscriber bearer token
      subscriberToken = await authService.createToken({}, subscriber)

      // buy subscription
      const agreementId = await nevermined.nfts721.order(ddoSubscription.id, subscriber)
      await nevermined.nfts721.claim(
        agreementId,
        publisher.getId(),
        subscriber.getId(),
        ddoSubscription.id,
      )
    })

    it('should not allow subscriptions the user does not own', async () => {
      const response = await request(app.getHttpServer())
        .get(`/${ddoWebService.id}`)
        .set('Authorization', `Bearer ${notSubscriberToken}`)

      expect(response.statusCode).toEqual(403)
      expect(response.text).toMatch(/does not have access to subscription/)
    })

    it('should not allow expired subscription', async () => {
      jest.spyOn(neverminedService, 'getDuration').mockImplementationOnce(async () => 1)

      const response = await request(app.getHttpServer())
        .get(`/${ddoWebService.id}`)
        .set('Authorization', `Bearer ${subscriberToken}`)

      expect(response.statusCode).toEqual(403)
      expect(response.text).toMatch(/is expired/)
    })

    it('should allow unlimited subscriptions', async () => {
      jest.spyOn(neverminedService, 'getDuration').mockImplementationOnce(async () => 0)
      const spyGetExpirationTime = jest.spyOn(subscriptionsService, 'getExpirationTime')

      const response = await request(app.getHttpServer())
        .get(`/${ddoWebService.id}`)
        .set('Authorization', `Bearer ${subscriberToken}`)

      expect(response.statusCode).toEqual(200)

      expect(await spyGetExpirationTime.mock.results[0].value).toEqual(
        subscriptionsService.defaultExpiryTime,
      )

      const { accessToken } = response.body
      const { jwtSecret } = configService.subscriptionsConfig()
      const { payload } = await jose.jwtDecrypt(accessToken, jwtSecret!)

      expect(payload.did).toEqual(ddoWebService.id)
      expect(payload.owner).toEqual(ownerAddress)
      expect(payload.userId).toEqual(subscriberAddress)
    })

    it('should allow limited duration subscriptions', async () => {
      jest.spyOn(neverminedService, 'getDuration').mockImplementationOnce(async () => 1000)

      const response = await request(app.getHttpServer())
        .get(`/${ddoWebService.id}`)
        .set('Authorization', `Bearer ${subscriberToken}`)

      expect(response.statusCode).toEqual(200)
    })

    it('should throw 403 if no event is found', async () => {
      jest
        .spyOn(
          neverminedService.nevermined.keeper.conditions.transferNft721Condition.events,
          'getPastEvents',
        )
        .mockResolvedValue([])

      const response = await request(app.getHttpServer())
        .get(`/${ddoWebService.id}`)
        .set('Authorization', `Bearer ${subscriberToken}`)

      expect(response.statusCode).toEqual(403)
    })

    it('should allow the owner to retrieve the token', async () => {
      const ownerToken = await authService.createToken({}, publisher)

      const response = await request(app.getHttpServer())
        .get(`/${ddoWebService.id}`)
        .set('Authorization', `Bearer ${ownerToken}`)

      expect(response.statusCode).toEqual(200)

      const { accessToken } = response.body
      const { jwtSecret } = configService.subscriptionsConfig()
      const { payload } = await jose.jwtDecrypt(accessToken, jwtSecret)

      expect(payload.did).toEqual(ddoWebService.id)
      expect(payload.owner).toEqual(ownerAddress)
      expect(payload.userId).toEqual(ownerAddress)
    })
  })

  describe('GET /subscriptions should validate the subscription (1155)', () => {
    let ddoWebService: DDO
    let ddoSubscription: DDO
    let notSubscriberToken: string
    let subscriberToken: string
    let subscriberAddress: string
    let ownerAddress: string
    const subscriptionCredits = 100n
    let publisher: NvmAccount
    let subscriber: NvmAccount
    let notSubscriber: NvmAccount

    beforeAll(async () => {
      ;[publisher, subscriber, notSubscriber] = nevermined.accounts.list()
      subscriberAddress = subscriber.getId()
      ownerAddress = publisher.getId()

      const contractABI = await ContractHandler.getABIArtifact(
        'NFT1155SubscriptionUpgradeable',
        './integration/resources/',
      )
      const subscriptionNFT = await SubscriptionCreditsNFTApi.deployInstance(
        config,
        contractABI,
        publisher,
        [
          publisher.getId(),
          nevermined.keeper.didRegistry.address,
          'Credits Subscription NFT',
          'CRED',
          '',
          nevermined.keeper.nvmConfig.address,
        ],
      )

      await nevermined.contracts.loadNft1155Api(subscriptionNFT)
      await subscriptionNFT.grantOperatorRole(
        nevermined.keeper.conditions.transferNftCondition.address,
        publisher,
      )

      // get the subscription ddo
      const nftAttributesSubscription = NFTAttributes.getCreditsSubscriptionInstance({
        metadata: getMetadata(undefined, 'Subscription NFT1155'),
        services: [
          {
            serviceType: 'nft-sales',
            nft: { duration: 1000, nftTransfer: false, amount: subscriptionCredits },
          },
        ],
        providers: config.neverminedNodeAddress ? [config.neverminedNodeAddress] : [],
        nftContractAddress: subscriptionNFT.address,
        preMint: false,
      })
      ddoSubscription = await nevermined.nfts1155.create(nftAttributesSubscription, publisher)

      // ddo web service
      const serviceMetadata = getMetadata(undefined, 'Service Metadata')
      serviceMetadata.main.type = 'service'
      serviceMetadata.main.webService = {
        endpoints: [{ GET: 'https://example.com' }],
        internalAttributes: {
          authentication: {
            type: 'oauth',
            token: 'xxx',
          },
          headers: [{ Authorization: 'Bearer test' }],
        },
      }
      const nftAttributesNoContractAddress = NFTAttributes.getCreditsSubscriptionInstance({
        metadata: serviceMetadata,
        services: [
          {
            serviceType: 'nft-access',
            nft: { tokenId: ddoSubscription.shortId(), amount: 1n, nftTransfer: false },
          },
        ],
        providers: config.neverminedNodeAddress ? [config.neverminedNodeAddress] : [],
        nftContractAddress: subscriptionNFT.address,
        preMint: false,
      })
      ddoWebService = await nevermined.nfts1155.create(nftAttributesNoContractAddress, publisher)

      // not a subscriber bearer token
      notSubscriberToken = await authService.createToken({}, notSubscriber)

      // subscriber bearer token
      subscriberToken = await authService.createToken({}, subscriber)

      // buy subscription
      const agreementId = await nevermined.nfts1155.order(
        ddoSubscription.id,
        subscriptionCredits,
        subscriber,
      )
      await nevermined.nfts1155.claim(
        agreementId,
        publisher.getId(),
        subscriber.getId(),
        subscriptionCredits,
        ddoSubscription.id,
      )
    })

    it('should not allow subscriptions the user does not own', async () => {
      const response = await request(app.getHttpServer())
        .get(`/${ddoWebService.id}`)
        .set('Authorization', `Bearer ${notSubscriberToken}`)

      expect(response.statusCode).toEqual(403)
      expect(response.text).toMatch(/does not have access to subscription/)
    })

    it('should not allow expired subscription', async () => {
      // await mineBlocks(nevermined, subscriber, 10)
      jest.spyOn(neverminedService, 'getDuration').mockImplementationOnce(async () => 1)

      const response = await request(app.getHttpServer())
        .get(`/${ddoWebService.id}`)
        .set('Authorization', `Bearer ${subscriberToken}`)

      expect(response.statusCode).toEqual(403)
      expect(response.text).toMatch(/is expired/)
    })

    it('should allow unlimited subscriptions', async () => {
      jest.spyOn(neverminedService, 'getDuration').mockImplementationOnce(async () => 0)
      const spyGetExpirationTime = jest.spyOn(subscriptionsService, 'getExpirationTime')

      const response = await request(app.getHttpServer())
        .get(`/${ddoWebService.id}`)
        .set('Authorization', `Bearer ${subscriberToken}`)

      expect(response.statusCode).toEqual(200)

      expect(await spyGetExpirationTime.mock.results[0].value).toEqual(
        subscriptionsService.defaultExpiryTime,
      )

      const { accessToken } = response.body
      const { jwtSecret } = configService.subscriptionsConfig()
      const { payload } = await jose.jwtDecrypt(accessToken, jwtSecret)

      expect(payload.did).toEqual(ddoWebService.id)
      expect(payload.owner).toEqual(ownerAddress)
      expect(payload.userId).toEqual(subscriberAddress)
    })

    it('should allow limited duration subscriptions', async () => {
      jest.spyOn(neverminedService, 'getDuration').mockImplementationOnce(async () => 1000)

      const response = await request(app.getHttpServer())
        .get(`/${ddoWebService.id}`)
        .set('Authorization', `Bearer ${subscriberToken}`)

      expect(response.statusCode).toEqual(200)
    })

    it('should throw 403 if no event is found', async () => {
      jest
        .spyOn(
          neverminedService.nevermined.keeper.conditions.transferNftCondition.events,
          'getPastEvents',
        )
        .mockResolvedValue([])

      const response = await request(app.getHttpServer())
        .get(`/${ddoWebService.id}`)
        .set('Authorization', `Bearer ${subscriberToken}`)

      expect(response.statusCode).toEqual(403)
    })

    it('should allow the owner to retrieve the token', async () => {
      const ownerToken = await authService.createToken({}, publisher)

      const response = await request(app.getHttpServer())
        .get(`/${ddoWebService.id}`)
        .set('Authorization', `Bearer ${ownerToken}`)

      expect(response.statusCode).toEqual(200)

      const { accessToken } = response.body
      const { jwtSecret } = configService.subscriptionsConfig()
      const { payload } = await jose.jwtDecrypt(accessToken, jwtSecret)

      expect(payload.did).toEqual(ddoWebService.id)
      expect(payload.owner).toEqual(ownerAddress)
      expect(payload.userId).toEqual(ownerAddress)
    })
  })
})
