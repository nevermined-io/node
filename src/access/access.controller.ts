import { Body, Controller, Get, Param, Post, Req, Response, StreamableFile, UploadedFile, UseInterceptors } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Request } from '../common/helpers/request.interface';
import { IsNumber, IsString } from "class-validator";
import { Public } from "../common/decorators/auth.decorator";
import { downloadAsset, getNevermined, uploadFilecoin, uploadS3 } from '../common/helpers/agreement';
import { FileInterceptor } from "@nestjs/platform-express";
import crypto from 'crypto';
import { aes_encryption_256 } from "../common/helpers/utils";
import { ValidationParams } from "@nevermined-io/nevermined-sdk-js/dist/node/ddo/Service";
import BigNumber from "@nevermined-io/nevermined-sdk-js/dist/node/utils/BigNumber";

export class UploadResult {
  @ApiProperty({
    description: 'Url of the uploaded file',
    example: 'cid://bawoeijdoidewj',
    required: true,
  })
  url: string;
  @ApiProperty({
    description: 'Password for encrypted file',
    example: '1234#',
  })
  password?: string;
}

export class UploadDto {
  @ApiProperty({
    description: 'Encrypt uploaded data',
    example: 'false',
    required: false,
  })
  encrypt: string;
}

export class TransferDto {
  @ApiProperty({
    description: 'The agreement for NFT transfer',
    example: '0x...'
  })
  @IsString()
  agreementId: string;

  @ApiProperty({
    description: 'NFT holder address',
    example: '0x...'
  })
  @IsString()
  nftHolder: string;

  @ApiProperty({
    description: 'NFT receiver address',
    example: '0x...'
  })
  @IsString()
  nftReceiver: string;

  @ApiProperty({
    description: 'Number of NFTs to transfer',
    example: '1'
  })
  @IsString()
  nftAmount: string;

  @ApiProperty({
    description: 'Type of NFT',
    example: '721'
  })
  @IsNumber()
  nftType: number;
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
    type: StreamableFile,
  })
  @ApiBearerAuth('Authorization')
  async doAccess(
    @Req() req: Request<unknown>,
    @Response({ passthrough: true }) res,
    @Param('index') index: number,
  ): Promise<StreamableFile|string> {
    return await downloadAsset(req.user.did, index, res);
  }

  @Get('nft-access/:agreement_id/:index')
  @ApiOperation({
    description: 'Access asset',
    summary: 'Public',
  })
  @ApiResponse({
    status: 200,
    description: 'Return the url of asset',
    type: StreamableFile,
  })
  @ApiBearerAuth('Authorization')
  async doNftAccess(
    @Req() req: Request<unknown>,
    @Response({ passthrough: true }) res,
    @Param('index') index: number,
  ): Promise<StreamableFile|string> {
    return await downloadAsset(req.user.did, index, res);
  }

  @Post('nft-transfer')
  @ApiOperation({
    description: 'Access asset',
    summary: 'Public',
  })
  @Public()
  @ApiResponse({
    status: 200,
    description: 'Return "success" if transfer worked',
  })
  async doNftTransfer(@Body() transferData: TransferDto, @Req() req: Request<unknown>): Promise<string> {
    const nevermined = await getNevermined();
    const params: ValidationParams = {
      consumer_address: transferData.nftReceiver,
      did: (await nevermined.keeper.agreementStoreManager.getAgreement(transferData.agreementId)).did,
      agreement_id: transferData.agreementId,
      nft_amount: BigNumber.from(transferData.nftAmount || '0'),
      buyer: (req.user || {}).buyer , 
    };
    const plugin = nevermined.assets.servicePlugin['nft-sales'];
    const [from] = await nevermined.accounts.list();
    await plugin.process(params, from, undefined);
    return 'success';
  }

  @Get('download/:index')
  @ApiOperation({
    description: 'Download asset',
    summary: 'Public',
  })
  @ApiResponse({
    status: 200,
    description: 'Return the asset',
    type: StreamableFile,
  })
  @ApiBearerAuth('Authorization')
  async doDownload(
    @Req() req: Request<unknown>,
    @Response({ passthrough: true }) res,
    @Param('index') index: number,
  ): Promise<StreamableFile|string> {
    return await downloadAsset(req.user.did, index, res);
  }

  @Post('upload/:backend')
  @ApiOperation({
    description: 'Access asset',
    summary: 'Public',
  })
  @Public()
  @UseInterceptors(FileInterceptor('file'))
  @ApiResponse({
    status: 200,
    description: 'Return the url of asset',
  })
  async doUpload(@Body() uploadData: UploadDto, @Param('backend') backend: string, @UploadedFile() file: Express.Multer.File): Promise<UploadResult> {
    let data = file.buffer;
    if (uploadData.encrypt) {
      // generate password
      const password = crypto.randomBytes(32).toString('base64url');
      data = Buffer.from(aes_encryption_256(data, password));
      if (backend === 's3') {
        const url = await uploadS3(data, file.filename);
        return { url, password };
      } else if (backend === 'filecoin') {
        const url = await uploadFilecoin(data, file.filename);
        return { url, password };
      }
    }
    if (backend === 's3') {
      const url = await uploadS3(data, file.filename);
      return { url };
    } else if (backend === 'filecoin') {
      const url = await uploadFilecoin(data, file.filename);
      return { url };
    }
  }

}

