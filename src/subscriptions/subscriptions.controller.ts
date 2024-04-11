import { Controller, ForbiddenException, Get, Logger, Param, Req } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { SubscriptionTokenDto } from './dto/token.dto'
import { SubscriptionsService } from './subscriptions.service'

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

    const subscriptionData = await this.subscriptionService.validateServiceDid(did)

    // validate that the subscription is valid
    let expiryTime: string
    Logger.debug(
      `Getting Access Token: Req.user.address: ${req.user.address} Subscription Owner: ${subscriptionData.owner}`,
    )
    const isOwner = req.user.address.toLowerCase() === subscriptionData.owner.toLowerCase()
    if (!isOwner) {
      const isValid = await this.subscriptionService.isSubscriptionValid(
        subscriptionData.contractAddress,
        subscriptionData.ercType,
        subscriptionData.numberNfts,
        req.user.address,
        subscriptionData.tokenId as string,
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
      expiryTime = await this.subscriptionService.getExpirationTime(
        subscriptionData.contractAddress,
        req.user.address,
        subscriptionData.ercType,
        subscriptionData.tokenId,
      )
    } else {
      expiryTime = this.subscriptionService.defaultExpiryTime
    }

    Logger.debug(`Generating access token with expiration time: ${expiryTime}`)
    // get access token
    const accessToken = await this.subscriptionService.generateToken(
      did,
      subscriptionData.tokenId as string,
      req.user.address,
      subscriptionData.endpoints,
      expiryTime,
      subscriptionData.owner,
      subscriptionData.ercType,
      subscriptionData.headers,
    )

    return {
      accessToken: accessToken,
      neverminedProxyUri: this.subscriptionService.neverminedProxyUri,
    }
  }
}
