import { Controller, ForbiddenException, Get, Param, Req } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { LoginDto } from '../auth/dto/login.dto'
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
    type: LoginDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized access',
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
      throw new ForbiddenException(`user ${req.user.iss} has not access to subscription ${did}`)
    }

    // get expiry time
    const expiryTime = await this.subscriptionService.getExpirationTime(
      contractAddress,
      req.user.address,
    )

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
