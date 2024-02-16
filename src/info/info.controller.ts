import { Get, Req, Controller } from '@nestjs/common'
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { readFileSync } from 'fs'
import path from 'path'
import { Public } from '../common/decorators/auth.decorator'
import { Request } from '../common/helpers/request.interface'
import { GetInfoDto } from './dto/get-info.dto'
import { ethers } from 'ethers'
import NodeRSA from 'node-rsa'
import { NeverminedService } from '../shared/nevermined/nvm.service'
import { ConfigService } from '../shared/config/config.service'

@ApiTags('Info')
@Controller()
export class InfoController {
  constructor(
    private nvmService: NeverminedService,
    private config: ConfigService,
  ) {}
  @Get()
  @ApiOperation({
    description: 'Get API info',
    summary: 'Public',
  })
  @ApiResponse({
    status: 200,
    description: 'Return API Info',
    type: GetInfoDto,
  })
  @Public()
  async getInfo(@Req() req: Request<unknown>): Promise<GetInfoDto> {
    const nevermined = this.nvmService.getNevermined()

    const pathEndpoint = `${req.protocol}://${req.hostname}${
      req.client.localPort ? `:${req.client.localPort}` : ''
    }${req.url}`
    const packageJsonPath = path.join(__dirname, '../..', 'package.json')
    const packageJsonString = readFileSync(packageJsonPath, 'utf8')
    const packageJson = JSON.parse(packageJsonString) as { version: string }

    const provider_key_file = this.config.cryptoConfig().provider_key
    const provider_password = this.config.cryptoConfig().provider_password
    const wallet = await ethers.Wallet.fromEncryptedJson(provider_key_file, provider_password)

    const rsa_key_file = this.config.cryptoConfig().provider_rsa_public
    const key = new NodeRSA(rsa_key_file)

    const baby = this.config.getProviderBabyjub()
    const provenanceEnabled = this.config.get<boolean>('ENABLE_PROVENANCE')
    const artifactDir = this.config.get<string>('ARTIFACTS_FOLDER')
    const circuitDir = this.config.get<string>('CIRCUITS_FOLDER')

    const providerURL = new URL(this.nvmService.web3ProviderUri())

    const contractInstances = nevermined.keeper.getAllInstances()
    const keys = Object.keys(contractInstances).filter(
      (key) => contractInstances[key]?.address !== undefined,
    )
    const contracts = keys.map((key) => ({ [key]: contractInstances[key].address }))
    nevermined.keeper.didRegistry.version
    return {
      APIversion: packageJson.version,
      docs: `${pathEndpoint}api/v1/docs`,
      network: await nevermined.keeper.getNetworkName(),
      'keeper-url': `${providerURL.protocol}//${providerURL.host}`,
      'provenance-enabled': provenanceEnabled,
      'artifacts-folder': artifactDir,
      'circuits-folder': circuitDir,
      contracts: contracts,
      'external-contracts': [],
      'keeper-version': nevermined.keeper.didRegistry.version,
      'provider-address': this.nvmService.providerAddress,
      'ecdsa-public-key': wallet.signingKey.publicKey,
      'rsa-public-key': key.exportKey('public'),
      'babyjub-public-key': {
        x: baby.x,
        y: baby.y,
      },
    }
  }
}
