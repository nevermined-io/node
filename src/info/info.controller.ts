import { Get, Req, Controller } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { readFileSync } from 'fs';
import path from 'path';
import { Public } from '../common/decorators/auth.decorator';
import { Request } from '../common/helpers/request.interface';
import { GetInfoDto } from './dto/get-info.dto';
import { Nevermined } from '@nevermined-io/nevermined-sdk-js';
import { config } from '../config';
import ContractHandler from '@nevermined-io/nevermined-sdk-js/dist/node/keeper/ContractHandler';
import { generateIntantiableConfigFromConfig } from '@nevermined-io/nevermined-sdk-js/dist/node/Instantiable.abstract';
import { ethers } from 'ethers';
import NodeRSA from 'node-rsa';

const getProviderBabyjub = () => {
  return {
    x: process.env.PROVIDER_BABYJUB_PUBLIC1 || '',
    y: process.env.PROVIDER_BABYJUB_PUBLIC2 || '',
    secret: process.env.PROVIDER_BABYJUB_SECRET || '',
  };
};

@ApiTags('Info')
@Controller()
export class InfoController {
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
    const nevermined = await Nevermined.getInstance(config);
    const instanceConfig = {
      ...generateIntantiableConfigFromConfig(config),
      nevermined
    };
    const contractHandler = new ContractHandler(instanceConfig);
    const pathEndpoint = `${req.protocol}://${req.hostname}${req.client.localPort ? `:${req.client.localPort}` : ''}${
      req.url
    }`;
    const packageJsonPath = path.join(__dirname, '../..', 'package.json');
    const packageJsonString = readFileSync(packageJsonPath, 'utf8');
    const packageJson = JSON.parse(packageJsonString) as { version: string };

    const [
      // templateManagerOwner,
      // publisher,
      // consumer,
      provider
    ] = await nevermined.accounts.list();
    // console.log('accounts', await nevermined.accounts.list())

    const provider_key_file = readFileSync(process.env.PROVIDER_KEYFILE || '').toString();
    const provider_password = process.env.PROVIDER_PASSWORD || '';
    const wallet = await ethers.Wallet.fromEncryptedJson(provider_key_file, provider_password);

    const rsa_key_file = readFileSync(process.env.RSA_PUBKEY_FILE || '').toString();
    const key = new NodeRSA(rsa_key_file);

    const baby = getProviderBabyjub();
    const artifactDir = './artifacts';

    return {
      APIversion: packageJson.version,
      docs: `${pathEndpoint}api/v1/docs`,
      network: await nevermined.keeper.getNetworkName(),
      'keeper-url': config.nodeUri,
      contracts: [],
      'external-contracts': [],
      'keeper-version': await contractHandler.getVersion("DIDRegistry", artifactDir),
      'provider-address': provider.getId(),
      'ecdsa-public-key': wallet.publicKey,
      'rsa-public-key': key.exportKey('public'),
      'babyjub-public-key': {
        x: baby.x,
        y: baby.y,
      },
    };
  }
}
