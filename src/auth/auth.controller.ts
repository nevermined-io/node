import { Controller, Post, Req, UseGuards } from '@nestjs/common'
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { Public } from '../common/decorators/auth.decorator'
import { AuthService } from './auth.service'
import { LoginDto } from './dto/login.dto'
import { NeverminedGuard } from './nvm.guard'

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
  @UseGuards(NeverminedGuard)
  @Public()
  token(@Req() req): Promise<LoginDto> {
    return this.authService.validateClaim(req.user)
  }
}
