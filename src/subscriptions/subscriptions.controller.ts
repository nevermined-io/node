import { Controller, ForbiddenException, Get, Param, Req } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger'
import { LoginDto } from '../auth/dto/login.dto'
import { SubscriptionsService } from './subscriptions.service'

@Controller('subscriptions')
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
  async getAccessToken(@Req() req, @Param('did') did: string): Promise<LoginDto> {
    // get subscription data
    const { contractAddress, numberNfts, endpoints, headers } =
      await this.subscriptionService.validateDid(did)

    // validate that the subscription is valid
    const isValid = this.subscriptionService.isSubscriptionValid(
      contractAddress,
      numberNfts,
      req.user.iss,
    )

    if (!isValid) {
      throw new ForbiddenException(`user ${req.user.iss} has not access to subscription ${did}`)
    }

    // get access token
    const accessToken = await this.subscriptionService.generateToken(
      did,
      req.user.iss,
      endpoints,
      headers,
    )

    return { access_token: accessToken }
  }
}
