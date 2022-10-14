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
  import { DDO } from "@nevermined-io/nevermined-sdk-js";
  import { InitDto } from "./dto/init";

  @ApiTags('Compute')
  @Controller()
  export class ComputeController {
  
    constructor(private nvmService: NeverminedService) {}

    @Post('init')
    @ApiOperation({
        description: 'Compute Init',
        summary: 'Start the execution of a compute workflow',
    })
    @ApiResponse({
        status: 200,
        description: 'Returns the Workflow ID',
        type: String,
    })
    //@ApiBearerAuth('Authorization')
   @Public()
    async initCompute(
        @Body() initData: InitDto,
        @Req() req: Request<unknown>,
        @Response({ passthrough: true }) res: string
    ): Promise<string> {

        const ddo: DDO = DDO.deserialize(initData.computeDdoString)
        return "Compute started";
    }

    @Get('info/:workflowID')
    @ApiOperation({
        description: 'Info',
        summary: 'Returns info about a workflow',
    })
    @ApiResponse({
        status: 200,
        description: 'Returns an info object',
        type: String,
    })
    //@ApiBearerAuth('Authorization')
   @Public()
    async getWorkflowInfo(
        @Req() req: Request<unknown>,
        @Response({ passthrough: true }) res: string,
        @Param('workflowID') workflowID: string,
    ): Promise<string> {
        return "Info of workflow: " + workflowID;
    }

    @Get('status/:workflowID')
    @ApiOperation({
        description: 'Status',
        summary: 'Returns the complete status about a workflow',
    })
    @ApiResponse({
        status: 200,
        description: 'Returns a status object',
        type: String,
    })
    //@ApiBearerAuth('Authorization')
   @Public()
    async getWorkflowStatus(
        @Req() req: Request<unknown>,
        @Response({ passthrough: true }) res: string,
        @Param('workflowID') workflowID: string,
    ): Promise<string> {
        return "Status of workflow: " + workflowID;
    }

    @Get('stop/:workflowID')
    @ApiOperation({
        description: 'Stop',
        summary: 'Stop the execution of a workflow',
    })
    @ApiResponse({
        status: 200,
        description: 'Returns a success message',
        type: String,
    })
    //@ApiBearerAuth('Authorization')
   @Public()
    async stopWorkflowExecution(
        @Req() req: Request<unknown>,
        @Response({ passthrough: true }) res: string,
        @Param('workflowID') workflowID: string,
    ): Promise<string> {
        return "workflow " + workflowID + " successfully deleted";
    }

    @Get('logs/:workflowID')
    @ApiOperation({
        description: 'Logs',
        summary: 'Returns the logs of the execution of a workflow',
    })
    @ApiResponse({
        status: 200,
        description: 'Returns an object that contains the execution logs',
        type: String,
    })
    //@ApiBearerAuth('Authorization')
   @Public()
    async getWorkflowExecutionLogs(
        @Req() req: Request<unknown>,
        @Response({ passthrough: true }) res: string,
        @Param('workflowID') workflowID: string,
    ): Promise<string> {
        return "Logs of workflow: " + workflowID;
    }

    @Get('list')
    @ApiOperation({
        description: 'List of workflows',
        summary: 'Returns a list of all executed workflows',
    })
    @ApiResponse({
        status: 200,
        description: 'Returns an object that contains the list of workflows',
        type: String,
    })
    //@ApiBearerAuth('Authorization')
   @Public()
    async getWorkflowsList(
        @Req() req: Request<unknown>,
        @Response({ passthrough: true }) res: string
    ): Promise<string> {
        return "List of workflows: ";
    }


  }