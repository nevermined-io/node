import { BadRequestException, Body, Controller, Get, Req, Response, StreamableFile } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiResponse, ApiTags } from "@nestjs/swagger";
import { IsString } from "class-validator";
// import { Public } from '../common/decorators/auth.decorator';
import { Request } from '../common/helpers/request.interface';
import { Nevermined } from '@nevermined-io/nevermined-sdk-js'
import { config } from '../config'
import { decrypt } from "../common/helpers/utils";
import download from 'download';

export class AccessResult {
  res: string
}

export class AccessDto {
    @ApiProperty({
        example: 'PSK-ECDSA',
        description: 'Encryption method',
    })
    @IsString()
    method: string;
    @ApiProperty({
        example: 'Hello!',
        description: 'Encrypted message',
    })
    @IsString()
    message: string;
}

@ApiTags('Access')
@Controller()
export class AccessController {
  @Get('access/:agreement_id')
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
  async doAccess(@Body() _accessData: AccessDto, @Req() req: Request<unknown>, @Response({ passthrough: true }) res): Promise<StreamableFile> {
    // const consumer_address = req.user.address
    // const agreement_id = req.user.userId
    const did = req.user.did
    const nevermined = await Nevermined.getInstance(config)
    // get url for DID
    const asset = await nevermined.assets.resolve(did)
    const index = 0
    const service = asset.findServiceByType('metadata')
    const file_attributes = service.attributes.main.files[index]
    const content_type = file_attributes.contentType
    const auth_method = asset.findServiceByType('authorization').service
    if (auth_method === 'RSAES-OAEP') {
      let filelist = JSON.parse(await decrypt(service.attributes.encryptedFiles, 'PSK-RSA'))
      // download url or what?
      let url: string = filelist[index].url
      let filename = url.split("/").slice(-1)
      let contents: Buffer = await download(url)
      res.set({
        'Content-Type': content_type,
        'Content-Disposition': `attachment; filename="${filename}"`,
      });
      return new StreamableFile(contents)
    }
    throw new BadRequestException()
  }
}

