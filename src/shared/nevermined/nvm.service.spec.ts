import {Test, TestingModule} from '@nestjs/testing'
import {NeverminedService} from './nvm.service'
import {ConfigService} from '../config/config.service'
import {HttpService} from '@nestjs/axios'
import {createMock} from "@golevelup/ts-jest"
import {BadRequestException} from "@nestjs/common"
import * as AWSsdkMock from 'aws-sdk-mock'
describe('NeverminedService', () => {
    let neverminedService: NeverminedService
    let configServiceMock
    let httpServiceMock

    beforeEach(async () => {
        AWSsdkMock.mock('S3', 'upload', jest.fn().mockResolvedValue({ Location: 'https://example.com/file.jpg' }))
        configServiceMock = createMock<ConfigService>({
            computeConfig: () => ({
                argo_namespace: 'argo',
            }),
            cryptoConfig: () => ({
                provider_key: './keyfile.json',
                provider_password: 'password',
            }),
            nvm: () => ({
                neverminedNodeAddress: '0x068ed00cf0441e4829d9784fcbe7b9e26d4bd8d0',
            }),
        })

        httpServiceMock = createMock<HttpService>({
            get: jest.fn().mockReturnValue({
                data: {
                    files: [
                        {
                            url: 'https://example.com/file.png',
                            contentType: 'image/png',
                            name: 'file.png',
                        },
                    ],
                },
            }),
        })

        const nvmModule: TestingModule = await Test.createTestingModule({
            providers: [NeverminedService,
                {
                    provide: ConfigService,
                    useValue: configServiceMock,
                },
                {
                    provide: HttpService,
                    useValue: httpServiceMock,
                },
            ],
        }).compile()

        neverminedService = nvmModule.get<NeverminedService>(NeverminedService)
    })

    afterEach(() => {
        AWSsdkMock.restore()
    })

    it('NeverminedService should be defined', () => {
        expect(neverminedService).toBeDefined()
    })

    it('should throw an exception when the DID is not valid', async () => {
            await expect(neverminedService.getAssetUrl('did:ethr:0x123', 0)).rejects.toThrow(BadRequestException)
        }
    )

    it('should throw an error if the bucket does not exist', async () => {
        AWSsdkMock.mock('S3', 'upload', jest.fn().mockRejectedValue({ code: 'NoSuchBucket' }))
        await expect(neverminedService.uploadS3(Buffer.from('file content'), 'file.jpg')).rejects.toThrowError('Cannot convert object to primitive value')
    })

})