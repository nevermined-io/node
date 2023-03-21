import { Controller, ForbiddenException, Get, Param, Req } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { SubscriptionTokenDto } from './dto/token.dto'
import { SubscriptionsService } from './subscriptions.service'
import { Logger } from '../shared/logger/logger.service'

@ApiTags('Subscriptions')
@Controller()
export class SubscriptionsController {
  constructor(private subscriptionService: SubscriptionsService) {}

  @Get(':did')
  @ApiOperation({
    description: 'Get and access token for a subscription',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns the access token',
    type: SubscriptionTokenDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized access',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request',
  })
  @ApiResponse({
    status: 403,
    description: 'Subscription not valid or expired',
  })
  @ApiBearerAuth('Authorization')
  async getAccessToken(@Req() req, @Param('did') did: string): Promise<SubscriptionTokenDto> {
    // get subscription data
    const { contractAddress, numberNfts, endpoints, headers } =
      await this.subscriptionService.validateDid(did)

    // validate that the subscription is valid
    const isValid = await this.subscriptionService.isSubscriptionValid(
      contractAddress,
      numberNfts,
      req.user.address,
    )

    if (!isValid) {
      Logger.debug(
        `[GET /subscriptions] ${did}: user ${req.user.address} does not have access to subscription`,
      )
      throw new ForbiddenException(
        `user ${req.user.address} does not have access to subscription ${did}`,
      )
    }

    // get expiry time
    const expiryTime = await this.subscriptionService.getExpirationTime(
      contractAddress,
      req.user.address,
    )

    Logger.debug(`Generating access token with expiration time: ${expiryTime}`)
    // get access token
    const accessToken = await this.subscriptionService.generateToken(
      did,
      req.user.iss,
      endpoints,
      expiryTime,
      headers,
    )

    return {
      accessToken: accessToken,
      neverminedProxyUri: this.subscriptionService.neverminedProxyUri,
    }
  }
}
