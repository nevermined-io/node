import { ComputeService } from './compute.service'
import { NeverminedService } from '../shared/nevermined/nvm.service'
import { ConfigService } from '../shared/config/config.service'
import { ExecuteWorkflowDto } from './dto/executeWorkflowDto'
import { Test, TestingModule } from '@nestjs/testing'
import { createMock } from '@golevelup/ts-jest'
import { DDO } from '@nevermined-io/nevermined-sdk-js'
import { MetaData } from '@nevermined-io/nevermined-sdk-js'

describe('ComputeService Testing', () => {
  let computeService: ComputeService
  let configServiceMock
  let nvmServiceMock

  const ddo: DDO = new DDO()
  ddo.id = 'did:nv:112233'

  const queryResult = {
    totalResults: {
      value: 1,
    },
    results: [{ id: 'did:nv:1234' }],
  }

  // mix in the same mock the metadata for algorithm and workflow
  const metadataMock: MetaData = {
    main: {
      name: '',
      type: 'dataset',
      dateCreated: '',
      author: '',
      license: '',
      algorithm: {
        language: 'python',
        format: 'py',
        version: '0.1',
        entrypoint: 'python word_count.py*',
        requirements: {
          container: {
            image: 'python',
            tag: '3.8-alpine',
            checksum: 'sha256:53ad3a03b2fb240b6c494339821e6638cd44c989bcf26ec4d51a6a52f7518c1d',
          },
        },
      },
      workflow: {
        coordinationType: 'argo',
        stages: [
          {
            index: 0,
            stageType: 'Filtering',
            input: [
              {
                index: 0,
                id: 'did:nv:11223344',
              },
            ],
            transformation: {
              id: 'did:nv:1122334455',
            },
            output: {
              metadataUrl: 'https://localhost:5000/api/v1/metadata/assets/ddo/',
              accessProxyUrl: 'https://localhost:8030/api/v1/node/',
              metadata: {} as any,
            },
          },
        ],
      },
    },
  }
  ddo.addDefaultMetadataService(metadataMock)

  beforeAll(async () => {
    const mockResolve = jest.fn()
    mockResolve.mockReturnValue(ddo)

    nvmServiceMock = createMock<NeverminedService>({
      getNevermined: () => ({
        keeper: {
          getNetworkName: () => 'geth_localnet',
        },
        search: {
          query: () => queryResult,
        },
      }),
      nevermined: {
        assets: {
          resolve: mockResolve,
        },
      },
    })

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

    const computeModule: TestingModule = await Test.createTestingModule({
      providers: [
        ComputeService,
        {
          provide: ConfigService,
          useValue: configServiceMock,
        },
        {
          provide: NeverminedService,
          useValue: nvmServiceMock,
        },
      ],
    }).compile()

    computeService = computeModule.get<ComputeService>(ComputeService)
  })

  it.skip('ComputeService should be defined', () => {
    expect(computeService).toBeDefined()
  })

  it('ComputeService should be properly configured', async () => {
    const argo_host = configServiceMock.computeConfig().argo_namespace
    expect(argo_host).toBe('argo')

    const provider_key = configServiceMock.cryptoConfig().provider_key
    expect(provider_key).toBe('./keyfile.json')

    const provider_password = configServiceMock.cryptoConfig().provider_password
    expect(provider_password).toBe('password')

    const neverminedNodeAddress = configServiceMock.nvm().neverminedNodeAddress
    expect(neverminedNodeAddress).toBe('0x068ed00cf0441e4829d9784fcbe7b9e26d4bd8d0')

    const network = nvmServiceMock.getNevermined().keeper.getNetworkName()
    expect(network).toBe('geth_localnet')

    const resolvedDdo = await nvmServiceMock.nevermined.assets.resolve('did:nv:112233')
    expect(resolvedDdo).toBeDefined()

    const medatada = resolvedDdo.findServiceByType('metadata')
    expect(medatada.type === 'metadata')

    const result = await nvmServiceMock.getNevermined().search.query({})
    expect(result.totalResults.value === 1)
  })

  it('should get workflow status', async () => {
    const workflowId = 'workflow1122'
    const statusNodes = {
      podconfig: {
        displayName: 'podconfig',
        phase: 'Succeeded',
        startedAt: '2022-01-09 10:00:00',
        finishedAt: '2022-01-09 10:01:00',
      },
      podtransform: {
        displayName: 'podtransform',
        phase: 'Succeeded',
        startedAt: '2022-01-09 10:01:00',
        finishedAt: '2022-01-09 10:02:00',
      },
      podpublish: {
        displayName: 'podpublish',
        phase: 'Succeeded',
        startedAt: '2022-01-09 10:03:00',
        finishedAt: '2022-01-09 10:04:00',
      },
      workflow1122: {
        displayName: workflowId,
        phase: 'Succeeded',
        startedAt: '2022-01-09 10:00:00',
        finishedAt: '2022-01-09 10:04:00',
      },
    }

    const responseBody = {
      status: {
        nodes: statusNodes,
      },
    }

    const workflowStatus = await computeService.createWorkflowStatus(responseBody, workflowId)
    expect(workflowStatus.status).toBe('Succeeded')
    expect(workflowStatus.pods.length).toBe(3)
    expect(workflowStatus.did).toBe('did:nv:1234')
  })

  it('should create correct argo workflow', async () => {
    const initData: ExecuteWorkflowDto = {
      workflowDid: 'did:nv:11223344',
      consumer: '0xaaabbbcc',
    }

    const workflow = await computeService.createArgoWorkflow(initData)
    expect(workflow).toBeDefined()
    expect(workflow.kind).toBe('Workflow')
    expect(workflow.spec).toBeDefined()
    expect(workflow.spec.entrypoint).toBe('compute-workflow')
    expect(workflow.spec.templates).toBeDefined()
    expect(workflow.spec.templates.length).toBe(4)
  })
})
