import { Body, Controller, Get, Param, Post, Req, Response, StreamableFile, UploadedFile, UseInterceptors } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Request } from '../common/helpers/request.interface';
import { Nevermined } from '@nevermined-io/nevermined-sdk-js';
import { config } from '../config';
import { /* IsBoolean,*/ IsNumber, IsString } from "class-validator";
import { Public } from "../common/decorators/auth.decorator";
import { downloadAsset, /* getAssetUrl, */ uploadFilecoin, uploadS3, validateAgreement } from '../common/helpers/agreement';
import { FileInterceptor } from "@nestjs/platform-express";
import crypto from 'crypto';
import { aes_encryption_256 } from "../common/helpers/utils";
import BigNumber from "@nevermined-io/nevermined-sdk-js/dist/node/utils/BigNumber";
// import { generateIntantiableConfigFromConfig } from "@nevermined-io/nevermined-sdk-js/dist/node/Instantiable.abstract";
// import { Dtp } from "@nevermined-io/nevermined-sdk-dtp/dist/Dtp";

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
  ): Promise<StreamableFile> {
    return await downloadAsset(req.user.did, index, res);
  }

  /*
  @Get('access-proof/:agreement_id/:index')
  @ApiOperation({
    description: 'Access asset w/ DTP proof',
    summary: 'Public',
  })
  @ApiResponse({
    status: 200,
    description: 'Return the url of asset',
    type: String,
  })
  @ApiBearerAuth('Authorization')
  async doAccessProof(
    @Req() req: Request<unknown>,
    @Response({ passthrough: true }) res,
    @Param('index') index: number,
  ): Promise<string> {
    return (await getAssetUrl(req.user.did, index)).url;
  }

  @Get('nft-access-proof/:agreement_id/:index')
  @ApiOperation({
    description: 'NFT Access asset w/ DTP proof',
    summary: 'Public',
  })
  @ApiResponse({
    status: 200,
    description: 'Return the url of asset',
    type: String,
  })
  @ApiBearerAuth('Authorization')
  async doNFTAccessProof(
    @Req() req: Request<unknown>,
    @Response({ passthrough: true }) res,
    @Param('index') index: number,
  ): Promise<string> {
    return (await getAssetUrl(req.user.did, index)).url;
  }*/

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
    description: 'Return "success" if transfer worked',
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
      const params = nevermined.keeper.templates.nftSalesTemplate.params(transferData.nftReceiver, BigNumber.from(transferData.nftAmount), transferData.nftHolder);
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

/*
  @Post('nft-transfer-proof')
  @ApiOperation({
    description: 'Access asset',
    summary: 'Public',
  })
  @ApiBearerAuth('Authorization')
  @ApiResponse({
    status: 200,
    description: 'Return "success" if transfer worked',
  })
  async doNftTransferProof(
    @Body() transferData: TransferDto,
    @Req() req: Request<unknown>,
  ): Promise<string> {
    const nevermined = await Nevermined.getInstance(config);
    const instanceConfig = {
      ...generateIntantiableConfigFromConfig(config),
      nevermined
    };
    const dtp = await Dtp.getInstance(instanceConfig);
    const buyer = req.user.buyer;
    const consumer = await dtp.babyjubPublicAccount('0x'+buyer.substring(0,64), '0x'+buyer.substring(64,128));
    if (transferData.nftType === 721) {
      const template = dtp.nft721SalesWithAccessTemplate;
      const params = template.params(consumer);
      const conditions = [
        {name: 'lock', fulfill: false},
        {name: 'transfer', fulfill: true, delegate: true, condition: nevermined.keeper.conditions.transferNft721Condition},
        {name: 'escrow', fulfill: true, condition: nevermined.keeper.conditions.escrowPaymentCondition},
        {name: 'access', fulfill: true, condition: dtp.accessProofCondition},
      ];
      const agreement_id = transferData.agreementId;
      const agreement = await nevermined.keeper.agreementStoreManager.getAgreement(agreement_id);
      await validateAgreement({
        nevermined,
        agreement_id,
        did: agreement.did,
        params,
        template,
        conditions,
      });
    } else {
      const template = dtp.nftSalesWithAccessTemplate;
      const params = template.params(consumer, transferData.nftHolder, transferData.nftAmount);
      const conditions = [
        {name: 'lock', fulfill: false},
        {name: 'transfer', fulfill: true, delegate: true, condition: nevermined.keeper.conditions.transferNftCondition},
        {name: 'escrow', fulfill: true, condition: nevermined.keeper.conditions.escrowPaymentCondition},
        {name: 'access', fulfill: true, condition: dtp.accessProofCondition},
      ];
      const agreement_id = transferData.agreementId;
      const agreement = await nevermined.keeper.agreementStoreManager.getAgreement(agreement_id);
      await validateAgreement({
        nevermined,
        agreement_id,
        did: agreement.did,
        params,
        template,
        conditions,
      });
    }
    return 'success';
  }
*/

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

