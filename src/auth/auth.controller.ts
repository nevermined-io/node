import { Controller, Post, Body } from '@nestjs/common'
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { Public } from '../common/decorators/auth.decorator'
import { AuthService } from './auth.service'
import { ClientAssertionDto } from './dto/clientAssertion.dto'
import { LoginDto } from './dto/login.dto'
// import { Request } from '../common/helpers/request.interface';

@ApiTags('Auth')
@Controller()
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('token')
  @ApiOperation({
    description: 'Login using a JWT claim for client authentication',
    summary: 'Public',
  })
  @ApiResponse({
    status: 201,
    description: 'The access_token',
    type: LoginDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized access',
  })
  @Public()
  token(@Body() clientAssertion: ClientAssertionDto): Promise<LoginDto> {
    return this.authService.validateClaim(clientAssertion.grant_type, clientAssertion.assertion)
  }
}
