import { AuthService } from './auth.service'
import { JwtService } from '@nestjs/jwt'
import { NeverminedService } from '../shared/nevermined/nvm.service'
import { Test } from '@nestjs/testing'
import { ServiceType, ValidationParams } from '@nevermined-io/sdk'

describe('AuthService', () => {
  let authService: AuthService
  let nvmServiceMock
  let jwtServiceMock

  beforeEach(async () => {
    nvmServiceMock = {
      getNevermined: jest.fn().mockReturnValue({
        assets: {
          servicePlugin: {
            access: {
              accept: jest.fn().mockResolvedValue(true),
              process: jest.fn().mockResolvedValue(true),
            },
          },
          resolve: jest.fn().mockResolvedValue({
            findServiceByType: jest.fn().mockReturnValue({
              attributes: {
                main: {
                  ercType: 721,
                },
              },
            }),
          }),
        },
        keeper: {
          conditions: {
            accessCondition: {
              checkPermissions: jest.fn().mockResolvedValue(true),
            },
          },
        },
        nfts1155: {
          balance: jest.fn().mockResolvedValue(1n),
          servicePlugin: {
            accessNFT: {
              accept: jest.fn().mockResolvedValue(true),
              process: jest.fn().mockResolvedValue(true),
            },
          },
        },
        accounts: {
          list: jest.fn().mockResolvedValue([]),
        },
      }),
    }
    jwtServiceMock = {
      sign: jest.fn().mockReturnValue('token'),
      verify: jest.fn().mockReturnValue({ sub: 'user' }),
    }
    const authModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: JwtService,
          useValue: jwtServiceMock,
        },
        {
          provide: NeverminedService,
          useValue: nvmServiceMock,
        },
      ],
    }).compile()
    authService = authModule.get<AuthService>(AuthService)
  })

  describe('validateOwner', () => {
    it('should validate the owner and return true if the owner has permission to access', async () => {
      const did = 'did:nft:0x123'
      const consumer_address = '0x456'
      const params: ValidationParams = { agreement_id: '0x789', did, consumer_address }
      await authService.validateOwner(params)
      expect(
        nvmServiceMock.getNevermined().keeper.conditions.accessCondition.checkPermissions,
      ).toHaveBeenCalledWith(consumer_address, did)
    })
  })

  describe('validateAccess', () => {
    it('should validate the access and return true if the service is granted', async () => {
      const params: ValidationParams = {
        did: '0x123',
        agreement_id: '0x12345',
        consumer_address: '0x456',
      }
      const service: ServiceType = 'access'
      await authService.validateAccess(params, service)
      expect(
        await nvmServiceMock.getNevermined().assets.servicePlugin.access.accept,
      ).toHaveBeenCalledWith(params)
    })
  })
})
