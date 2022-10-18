import { 
    Body, 
    Controller,
    Get,  
    Param, 
    Post, 
    Req, 
    Response, 
    NotFoundException,
    InternalServerErrorException,
  } from "@nestjs/common";
  import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
  import { Public } from "../common/decorators/auth.decorator";
  import { Request } from '../common/helpers/request.interface';
  //import { NeverminedService } from '../shared/nevermined/nvm.service';
  import { ComputeService } from './compute.service'
  //import { DDO } from "@nevermined-io/nevermined-sdk-js";
  import { InitDto } from "./dto/init";
  //import {ApiClient, WorkflowServiceApi} from "argo_workflows_api"
  import { WorkflowServiceApi} from "argo_workflows_api"
  import {IoArgoprojWorkflowV1alpha1WorkflowCreateRequest} from  'argo_workflows_api'
  import { Logger } from '../shared/logger/logger.service';
  import { ConfigService } from  '../shared/config/config.service'

  const yaml = require('js-yaml');



  @ApiTags('Compute')
  @Controller()
  export class ComputeController {
  
    /*
    constructor(private nvmService: NeverminedService,
                private computeService: ComputeService) {}
                */

    constructor(
                private computeService: ComputeService,
                private configService: ConfigService) {}


    workflowServiceApi = new WorkflowServiceApi();


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

        let sampleWorkflow = this.computeService.readWorkflowTemplate()
        const createParams = IoArgoprojWorkflowV1alpha1WorkflowCreateRequest.constructFromObject({ namespace: "argo", workflow: sampleWorkflow}, new IoArgoprojWorkflowV1alpha1WorkflowCreateRequest())
        const response = await this.workflowServiceApi.workflowServiceCreateWorkflow( createParams, "argo")
        return response.body

        //const ddo: DDO = DDO.deserialize(initData.computeDdoString)
       
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

        Logger.debug(`Getting information about workflow ${workflowID}`);

        try {
            const response = await this.workflowServiceApi.workflowServiceGetWorkflow("argo", workflowID, {})
            return response.body.metadata
        }catch(e) {
            Logger.error(`Error trying to get information about workflow ${workflowID}`);
            throw new NotFoundException(`Workflow ${workflowID} not found`);
        }   
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
        
        Logger.debug(`Getting status about workflow ${workflowID}`);

        try {
            const response = await this.workflowServiceApi.workflowServiceGetWorkflow("argo", workflowID, {})
            return response.body
        }catch(e) {
            Logger.error(`Error trying to get status about workflow ${workflowID}`);
            throw new NotFoundException(`Workflow ${workflowID} not found`);
        }   
        
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

        Logger.debug(`Getting list of workflows`);

        try {
            var opts = {};
            const response = await this.workflowServiceApi.workflowServiceListWorkflows("argo", opts)
            const result = []

            response.body.items.forEach(element => {
                result.push(element.metadata.name)
            });
            
            return JSON.stringify(result)
        }catch(e) {
            Logger.error(`Error trying to get the list of status: ${e}`);
            throw new InternalServerErrorException('There was an error trying to get the list of workflows');
        }       
       
    }


  }