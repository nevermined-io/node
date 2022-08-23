import { Body, Controller, Get, Param, Post, Req, Response, StreamableFile, UploadedFile, UseInterceptors } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Request } from '../common/helpers/request.interface';
import { Nevermined } from '@nevermined-io/nevermined-sdk-js';
import { config } from '../config';
import { /* IsBoolean,*/ IsNumber, IsString } from "class-validator";
import { Public } from "../common/decorators/auth.decorator";
import { downloadAsset, getAssetUrl, uploadFilecoin, uploadS3, validateAgreement } from '../common/helpers/agreement';
import { FileInterceptor } from "@nestjs/platform-express";
import crypto from 'crypto';
import { aes_encryption_256 } from "../common/helpers/utils";

export class AccessResult {
  res: string;
}

export class UploadResult {
  url: string;
  password?: string;
}

export class UploadDto {
  /*
  @ApiProperty({
    description: 'Encrypt uploaded data',
    example: 'false',
    required: false,
  })
  */
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
  @IsNumber()
  nftAmount: number;

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
    type: AccessResult,
  })
  @ApiBearerAuth('Authorization')
  async doAccess(
    @Req() req: Request<unknown>,
    @Response({ passthrough: true }) res,
    @Param('index') index: number,
  ): Promise<StreamableFile> {
    return await downloadAsset(req.user.did, index, res);
  }

  @Get('access-proof/:agreement_id/:index')
  @ApiOperation({
    description: 'Access asset w/ DTP proof',
    summary: 'Public',
  })
  @ApiResponse({
    status: 200,
    description: 'Return the url of asset',
    type: AccessResult,
  })
  @ApiBearerAuth('Authorization')
  async doAccessProof(
    @Req() req: Request<unknown>,
    @Response({ passthrough: true }) res,
    @Param('index') index: number,
  ): Promise<string> {
    return (await getAssetUrl(req.user.did, index)).url;
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
    description: 'Return the url of asset',
  })
  async doNftTransfer(@Body() transferData: TransferDto): Promise<string> {
    const nevermined = await Nevermined.getInstance(config);
    if (transferData.nftType === 721) {
      const params = nevermined.keeper.templates.nft721SalesTemplate.params(transferData.nftReceiver);
      const conditions = [
        {name: 'lock', fulfill: false},
        {name: 'transfer', fulfill: true, delegate: true, condition: nevermined.keeper.conditions.transferNft721Condition},
        {name: 'escrow', fulfill: true, condition: nevermined.keeper.conditions.escrowPaymentCondition},
      ];
      const agreement_id = transferData.agreementId;
      const agreement = await nevermined.keeper.agreementStoreManager.getAgreement(agreement_id);
      await validateAgreement({
        nevermined,
        agreement_id,
        did: agreement.did,
        params,
        template: nevermined.keeper.templates.nft721SalesTemplate,
        conditions,
      });
    } else {
      const params = nevermined.keeper.templates.nftSalesTemplate.params(transferData.nftReceiver, transferData.nftAmount, transferData.nftHolder);
      const conditions = [
        {name: 'lock', fulfill: false},
        {name: 'transfer', fulfill: true, delegate: true, condition: nevermined.keeper.conditions.transferNftCondition},
        {name: 'escrow', fulfill: true, condition: nevermined.keeper.conditions.escrowPaymentCondition},
      ];
      const agreement_id = transferData.agreementId;
      const agreement = await nevermined.keeper.agreementStoreManager.getAgreement(agreement_id);
      await validateAgreement({
        nevermined,
        agreement_id,
        did: agreement.did,
        params,
        template: nevermined.keeper.templates.nftSalesTemplate,
        conditions,
      });
    }
    return 'success';
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

