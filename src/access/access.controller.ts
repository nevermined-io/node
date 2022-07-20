import { Body, Controller, Get, Req } from "@nestjs/common";
import { ApiOperation, ApiProperty, ApiResponse, ApiTags } from "@nestjs/swagger";
import { IsString } from "class-validator";
import { Public } from '../common/decorators/auth.decorator';
import { Request } from '../common/helpers/request.interface';
/*
import { ethers } from "ethers";
import { readFileSync } from "fs";
import path from "path";
*/

export class AccessResult {
  res: string
}

export class AccessDto {
    @ApiProperty({
        example: 'PSK-ECDSA',
        description: 'Encryption method',
    })
    @IsString()
    method: string;
    @ApiProperty({
        example: 'Hello!',
        description: 'Encrypted message',
    })
    @IsString()
    message: string;
}

@ApiTags('Access')
@Controller()
export class AccessController {
  @Get('access/:agreement_id')
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
  @Public()
  async doAccess(@Body() _accessData: AccessDto, @Req() req: Request<unknown>): Promise<AccessResult> {
    // req.
    return { res: '' }
  }
}

