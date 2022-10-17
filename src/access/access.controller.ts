import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Req,
  Response,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from '../common/helpers/request.interface';
import { Public } from '../common/decorators/auth.decorator';
import { FileInterceptor } from '@nestjs/platform-express';
import crypto from 'crypto';
import { aes_encryption_256 } from '@nevermined-io/nevermined-sdk-dtp/dist/utils';
import { ValidationParams } from '@nevermined-io/nevermined-sdk-js/dist/node/ddo/Service';
import BigNumber from '@nevermined-io/nevermined-sdk-js/dist/node/utils/BigNumber';
import { NeverminedService } from '../shared/nevermined/nvm.service';
import { Logger } from '../shared/logger/logger.service';
import { TransferDto } from './dto/transfer';
import { UploadDto } from './dto/upload';
import { UploadResult } from './dto/upload-result';
import { AgreementData } from '@nevermined-io/nevermined-sdk-js/dist/node/keeper/contracts/managers';

@ApiTags('Access')
@Controller()
export class AccessController {
  constructor(private nvmService: NeverminedService) {}

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
    @Param('index') index: number
  ): Promise<StreamableFile | string> {
    if (!req.user.did) {
      throw new BadRequestException('DID not specified');
    }
    return await this.nvmService.downloadAsset(req.user.did, index, res, req.user.address);
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
    @Param('index') index: number
  ): Promise<StreamableFile | string> {
    return await this.nvmService.downloadAsset(req.user.did, index, res, req.user.address);
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
    Logger.debug(`Transferring NFT with agreement ${transferData.agreementId}`);
    const nevermined = this.nvmService.getNevermined();
    let agreement: AgreementData;
    try {
      agreement = await nevermined.keeper.agreementStoreManager.getAgreement(transferData.agreementId);
    } catch (e) {
      Logger.error(`Error resolving agreement ${transferData.agreementId}`);
      throw new NotFoundException(`Agreement ${transferData.agreementId} not found`);
    }
    if (!agreement) {
      Logger.error(`Agreement ${transferData.agreementId} not found`);
      throw new NotFoundException(`Agreement ${transferData.agreementId} not found`);
    }
    const params: ValidationParams = {
      consumer_address: transferData.nftReceiver,
      did: agreement.did,
      agreement_id: transferData.agreementId,
      nft_amount: BigNumber.from(transferData.nftAmount || '0'),
      buyer: (req.user || {}).buyer,
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
    @Param('index') index: number
  ): Promise<StreamableFile | string> {
    if (!req.user.did) {
      throw new BadRequestException('DID not specified');
    }
    return await this.nvmService.downloadAsset(req.user.did, index, res, req.user.address);
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
  async doUpload(
    @Body() uploadData: UploadDto,
    @Param('backend') backend: string,
    @UploadedFile() file: Express.Multer.File
  ): Promise<UploadResult> {
    if (!file) {
      throw new BadRequestException('No file in request');
    }
    let data = file.buffer;
    if (uploadData.encrypt) {
      // generate password
      Logger.debug(`Uploading with password, filename ${file.filename}`);
      const password = crypto.randomBytes(32).toString('base64url');
      data = Buffer.from(aes_encryption_256(data, password));
      if (backend === 's3') {
        const url = await this.nvmService.uploadS3(data, file.filename);
        return { url, password };
      } else if (backend === 'filecoin') {
        const url = await this.nvmService.uploadFilecoin(data, file.filename);
        return { url, password };
      }
    }
    if (backend === 's3') {
      const url = await this.nvmService.uploadS3(data, file.filename);
      return { url };
    } else if (backend === 'filecoin') {
      const url = await this.nvmService.uploadFilecoin(data, file.filename);
      return { url };
    }
  }
}
