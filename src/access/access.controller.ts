import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  InternalServerErrorException,
  Param,
  Post,
  Query,
  Req,
  Response,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
  ForbiddenException,
  Logger,
} from '@nestjs/common'
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiInternalServerErrorResponse,
  ApiForbiddenResponse,
} from '@nestjs/swagger'
import { Request } from '../common/helpers/request.interface'
import { Public } from '../common/decorators/auth.decorator'
import { FileInterceptor } from '@nestjs/platform-express'
import crypto from 'crypto'
import { AssetResult, NeverminedService } from '../shared/nevermined/nvm.service'
import { TransferDto } from './dto/transfer'
import { UploadDto } from './dto/upload'
import { UploadResult } from './dto/upload-result'
import {
  generateId,
  ValidationParams,
  BigNumber,
  AgreementData,
  ServiceType,
  DID,
  zeroX,
  ZeroAddress,
} from '@nevermined-io/sdk'
import { aes_encryption_256 } from '@nevermined-io/sdk-dtp'

export enum UploadBackends {
  IPFS = 'ipfs',
  Filecoin = 'filecoin',
  AmazonS3 = 's3',
}

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
  @ApiBadRequestResponse({
    status: 400,
    description: 'Bad Request. DID missing',
    type: BadRequestException,
  })
  @ApiBearerAuth('Authorization')
  async doAccess(
    @Req() req: Request<unknown>,
    @Response({ passthrough: true }) res,
    @Param('index') index: number,
    @Query('result') result: AssetResult,
  ): Promise<StreamableFile | string> {
    if (!req.user.did) {
      throw new BadRequestException('DID not specified')
    }
    return await this.nvmService.downloadAsset(req.user.did, index, res, req.user.address, result)
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
    @Query('result') result: AssetResult,
  ): Promise<StreamableFile | string> {
    return await this.nvmService.downloadAsset(req.user.did, index, res, req.user.address, result)
  }

  @Post('nft-transfer')
  @ApiOperation({
    description: 'Transfer an NFT',
    summary: 'Public',
  })
  @Public()
  @ApiResponse({
    status: 200,
    description: 'Return "success" if transfer worked',
  })
  @ApiNotFoundResponse({
    status: 404,
    description: 'Agreeement not found',
    type: NotFoundException,
  })
  @ApiForbiddenResponse({
    status: 403,
    description: 'Node was not able to transfer the NFT',
    type: ForbiddenException,
  })
  async doNftTransfer(
    @Body() transferData: TransferDto,
    @Req() req: Request<unknown>,
  ): Promise<string> {
    return this.internalTransfer(transferData, req, 'nft-sales')
  }

  private async internalTransfer(
    @Body() transferData: TransferDto,
    @Req() req: Request<unknown>,
    template: string,
  ): Promise<string> {
    Logger.debug(
      `[${transferData.did}] Transferring NFT with agreement ${transferData.agreementId}`,
    )
    const nevermined = this.nvmService.getNevermined()

    // Check the agreement exists on-chain
    try {
      const templateId: string = await nevermined.keeper.agreementStoreManager.call(
        'getAgreementTemplate',
        [zeroX(transferData.agreementId)],
      )
      if (templateId.toLowerCase() === ZeroAddress) {
        throw new NotFoundException(`Agreement ${transferData.agreementId} not found on-chain`)
      }
    } catch (e) {
      Logger.error(`Agreement ${transferData.agreementId} not found`)
      Logger.error(e)
      throw new NotFoundException(`Agreement ${transferData.agreementId} not found`)
    }

    let did: DID
    try {
      // If we get DID from the request, we use it
      if (transferData.did) {
        did = DID.parse(transferData.did)
      }
    } catch (e) {
      Logger.debug(`Unable to parse DID from the HTTP parameter: ${transferData.did}`)
    }

    if (!did) {
      // If we don't have a DID, we get it from the events
      let agreement: AgreementData
      try {
        agreement = await nevermined.keeper.agreementStoreManager.getAgreement(
          transferData.agreementId,
        )
        did = DID.parse(agreement.did)
      } catch (e) {
        Logger.error(`Error resolving agreement ${transferData.agreementId}`)
        Logger.error((e as Error).toString())
        throw new NotFoundException(`Agreement ${transferData.agreementId} not found`)
      }
      if (!agreement) {
        Logger.error(`Agreement ${transferData.agreementId} not found`)
        throw new NotFoundException(`Agreement ${transferData.agreementId} not found`)
      }
    }

    const subscriptionDDO = await this.nvmService.nevermined.assets.resolve(did.getDid())
    const duration = await this.nvmService.getDuration(subscriptionDDO, template as ServiceType)

    let expiration = 0
    if (duration > 0) {
      const currentBlockNumber = await this.nvmService.nevermined.web3.getBlockNumber()
      expiration = currentBlockNumber + duration
    }

    const params: ValidationParams = {
      consumer_address: transferData.nftReceiver,
      did: did.getDid(),
      agreement_id: transferData.agreementId,
      nft_amount: BigNumber.from(transferData.nftAmount || '0'),
      buyer: (req.user || {}).buyer,
      expiration,
    }

    const plugin = nevermined.assets.servicePlugin[template]
    const [from] = await nevermined.accounts.list()

    try {
      Logger.debug(
        `[${transferData.did}] Fulfilling transfer NFT with agreement ${transferData.agreementId}`,
      )
      await plugin.process(params, from, undefined)
    } catch (e) {
      Logger.error(`Failed to transfer NFT ${e}`)
      throw new ForbiddenException(
        `Could not transfer nft ${did.getDid()} to ${transferData.nftReceiver}`,
      )
    }

    return 'success'
  }

  @Post('nft-sales-proof')
  @ApiOperation({
    description: 'Transfer an NFT',
    summary: 'Public',
  })
  @ApiBearerAuth('Authorization')
  @ApiResponse({
    status: 200,
    description: 'Return "success" if transfer worked',
  })
  async doNftSales(
    @Body() transferData: TransferDto,
    @Req() req: Request<unknown>,
  ): Promise<string> {
    return this.internalTransfer(transferData, req, 'nft-sales-proof')
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
  @ApiBadRequestResponse({
    status: 400,
    description: 'Bad Request. DID missing',
    type: BadRequestException,
  })
  @ApiBearerAuth('Authorization')
  async doDownload(
    @Req() req: Request<unknown>,
    @Response({ passthrough: true }) res,
    @Param('index') index: number,
    @Query('result') result: AssetResult,
  ): Promise<StreamableFile | string> {
    if (!req.user.did) {
      throw new BadRequestException('DID not specified')
    }
    return await this.nvmService.downloadAsset(req.user.did, index, res, req.user.address, result)
  }

  @Post('upload/:backend')
  @ApiOperation({
    description: 'Uploads a file or some content to a remote storage',
    summary: 'Public',
  })
  @Public()
  @UseInterceptors(FileInterceptor('file'))
  @ApiResponse({
    status: 200,
    description: 'Return the url of the file uploaded',
  })
  @ApiBadRequestResponse({
    status: 400,
    description: 'Bad Request. File missing or  Backend not supported',
    type: BadRequestException,
  })
  @ApiInternalServerErrorResponse({
    status: 500,
    description: 'Error uploading file to backend',
    type: InternalServerErrorException,
  })
  async doUpload(
    @Body() uploadData: UploadDto,
    @Param('backend') backend: UploadBackends,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<UploadResult> {
    let data: Buffer
    let fileName: string
    if (file) {
      data = file.buffer
      fileName = file.originalname
    } else if (uploadData.message) {
      data = Buffer.from(uploadData.message)
      fileName = `fileUpload_${generateId()}.data${uploadData.encrypt ? '.encrypted' : ''}`
    } else {
      throw new BadRequestException('No file or message in request')
    }
    if (!Object.values(UploadBackends).includes(backend))
      throw new BadRequestException(`Backend ${backend} not supported`)
    try {
      let url: string
      if (uploadData.encrypt) {
        // generate password
        Logger.debug(`Uploading with password, filename ${fileName}`)
        const password = crypto.randomBytes(32).toString('base64url')
        data = Buffer.from(aes_encryption_256(data, password), 'binary')
        url = await this.nvmService.uploadToBackend(backend, data, fileName)
        return { url, password }
      }

      url = await this.nvmService.uploadToBackend(backend, data, fileName)
      return { url }
    } catch (error) {
      Logger.error(`Error processing upload: ${error.message}`)
      throw new InternalServerErrorException(error.message)
    }
  }
}
