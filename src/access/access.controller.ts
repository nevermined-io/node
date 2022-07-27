import { BadRequestException, Controller, Get, Param, Req, Response, StreamableFile } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Request } from '../common/helpers/request.interface';
import { Nevermined } from '@nevermined-io/nevermined-sdk-js'
import { config } from '../config'
import { decrypt } from "../common/helpers/utils";
import download from 'download';

export class AccessResult {
  res: string
}

async function downloadAsset(did: string, index: number, res: any): Promise<StreamableFile> {
  const nevermined = await Nevermined.getInstance(config)
  // get url for DID
  const asset = await nevermined.assets.resolve(did)
  const service = asset.findServiceByType('metadata')
  const file_attributes = service.attributes.main.files[index]
  const content_type = file_attributes.contentType
  const auth_method = asset.findServiceByType('authorization').service || 'RSAES-OAEP'
  if (auth_method === 'RSAES-OAEP') {
    let filelist = JSON.parse(await decrypt(service.attributes.encryptedFiles, 'PSK-RSA'))
    // download url or what?
    let url: string = filelist[index].url
    let filename = url.split("/").slice(-1)[0]
    let contents: Buffer = await download(url)
    res.set({
      'Content-Type': content_type,
      'Content-Disposition': `attachment;filename=${filename}`,
    });
    return new StreamableFile(contents)
  }
  throw new BadRequestException()
}

@ApiTags('Access')
@Controller()
export class AccessController {
  @Get('access/:agreement_id/:index')
  @ApiOperation({
    description: 'Access asset',
    summary: 'Public',
  })
  @ApiResponse({
    status: 200,
    description: 'Return the url of asset',
    type: AccessResult,
  })
  @ApiBearerAuth('Authorization')
  async doAccess(
    @Req() req: Request<unknown>,
    @Response({ passthrough: true }) res,
    @Param('index') index: number,
  ): Promise<StreamableFile> {
    return await downloadAsset(req.user.did, index, res)
  }

  @Get('nft-access/:agreement_id/:index')
  @ApiOperation({
    description: 'Access asset',
    summary: 'Public',
  })
  @ApiResponse({
    status: 200,
    description: 'Return the url of asset',
    type: AccessResult,
  })
  @ApiBearerAuth('Authorization')
  async doNftAccess(
    @Req() req: Request<unknown>,
    @Response({ passthrough: true }) res,
    @Param('index') index: number,
  ): Promise<StreamableFile> {
    return await downloadAsset(req.user.did, index, res)
  }

  @Get('download/:index')
  @ApiOperation({
    description: 'Download asset',
    summary: 'Public',
  })
  @ApiResponse({
    status: 200,
    description: 'Return the url of asset',
    type: AccessResult,
  })
  @ApiBearerAuth('Authorization')
  async doDownload(
    @Req() req: Request<unknown>,
    @Response({ passthrough: true }) res,
    @Param('index') index: number,
  ): Promise<StreamableFile> {
    return await downloadAsset(req.user.did, index, res)
  }
}

