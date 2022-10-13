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
    UseInterceptors 
  } from "@nestjs/common";
  import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
  import { Public } from "../common/decorators/auth.decorator";
  import { Request } from '../common/helpers/request.interface';
  import { NeverminedService } from '../shared/nevermined/nvm.service';

  @ApiTags('Compute')
  @Controller()
  export class ComputeController {
  
    constructor(private nvmService: NeverminedService) {}

    @Get('hello/:name')
    @ApiOperation({
        description: 'Compute hello',
        summary: 'REturns hello message',
    })
    @ApiResponse({
        status: 200,
        description: 'Return the messate',
        type: String,
    })
    //@ApiBearerAuth('Authorization')
   @Public()
    async sayHello(
        @Req() req: Request<unknown>,
        @Response({ passthrough: true }) res: string,
        @Param('name') name: string,
    ): Promise<string> {
        return "This is a hello message  to: " + name;
    }

  }