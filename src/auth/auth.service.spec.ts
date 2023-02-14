import { AuthService } from './auth.service'
import { JwtService } from '@nestjs/jwt'
import { NeverminedService } from '../shared/nevermined/nvm.service'
import { Test } from '@nestjs/testing'
import { Babysig, BigNumber, ServiceType, ValidationParams } from '@nevermined-io/sdk'
import { UnauthorizedException } from '@nestjs/common'

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
          balance: jest.fn().mockResolvedValue(BigNumber.from(1)),
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
      getDtp: jest.fn().mockReturnValue({
        keytransfer: {
          verifyBabyjub: jest.fn().mockResolvedValue(true),
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
      await authService.validateOwner(did, consumer_address)
      expect(
        nvmServiceMock.getNevermined().keeper.conditions.accessCondition.checkPermissions,
      ).toHaveBeenCalledWith(consumer_address, did)
    })
  })

  describe('validateAccess', () => {
    it('should validate the access and return true if the service is granted', async () => {
      const params: ValidationParams = { did: '0x123', agreement_id: '0x12345' }
      const service: ServiceType = 'access'
      await authService.validateAccess(params, service)
      expect(
        await nvmServiceMock.getNevermined().assets.servicePlugin.access.accept,
      ).toHaveBeenCalledWith(params)
    })
  })

  describe('ValidateTransferProof', () => {
    it('should throw an error if the signature is invalid', async () => {
      nvmServiceMock.getDtp.mockReturnValue({
        keytransfer: {
          verifyBabyjub: jest.fn(() => Promise.resolve(false)),
        },
      })

      const params: ValidationParams = {
        did: '0x123',
        agreement_id: '0x12345',
        buyer: '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        consumer_address: '0x0123456789abcdef0123456789abcdef0123456789',
        babysig:
          '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef' as never as Babysig,
      }

      await expect(authService.validateTransferProof(params)).rejects.toThrowError(
        UnauthorizedException,
      )
      expect(nvmServiceMock.getDtp().keytransfer.verifyBabyjub).toHaveBeenCalledWith(
        expect.any(Object),
        BigInt('0x0123456789abcdef0123456789abcdef0123456789'),
        '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      )
    })

    it('should not throw an error if the signature is valid', async () => {
      nvmServiceMock.getDtp.mockReturnValue({
        keytransfer: {
          verifyBabyjub: jest.fn(() => Promise.resolve(true)),
        },
      })

      const params: ValidationParams = {
        did: '0x123',
        agreement_id: '0x12345',
        buyer: '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        consumer_address: '0x0123456789abcdef0123456789abcdef0123456789',
        babysig:
          '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef' as never as Babysig,
      }

      await expect(authService.validateTransferProof(params)).resolves.not.toThrowError()
      expect(nvmServiceMock.getDtp().keytransfer.verifyBabyjub).toHaveBeenCalledWith(
        expect.any(Object),
        BigInt('0x0123456789abcdef0123456789abcdef0123456789'),
        '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      )
    })
  })
})
