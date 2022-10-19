import { 
    Body, 
    Controller,
    Get,  
    Param, 
    Post,
    Delete, 
    Req, 
    Response, 
    NotFoundException,
    InternalServerErrorException,
  } from "@nestjs/common";
  import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
  import { Public } from "../common/decorators/auth.decorator";
  import { Request } from '../common/helpers/request.interface';
  import { ComputeService } from './compute.service'
  import { InitDto } from "./dto/init";
  import { WorkflowServiceApi, ApiClient} from "argo_workflows_api"
  import {IoArgoprojWorkflowV1alpha1WorkflowCreateRequest} from  'argo_workflows_api'
  import { Logger } from '../shared/logger/logger.service';
  import { ConfigService } from  '../shared/config/config.service'

  const yaml = require('js-yaml');

  @ApiTags('Compute')
  @Controller()
  export class ComputeController {

    constructor(private computeService: ComputeService,
                private configService: ConfigService)
    {
        let argoClient = ApiClient.instance
        argoClient.basePath = this.configService.computeConfig().argo_host
        argoClient.disableTlsCert = this.configService.computeConfig().disable_tls_cert

    }
    
    private workflowServiceApi = new WorkflowServiceApi();
    private argoNamespace = this.configService.computeConfig().argo_namespace

    @Get('list')
    @ApiOperation({
        description: 'List of workflows',
        summary: 'Returns a list of all executed workflows',
    })
    @ApiResponse({
        status: 200,
        description: 'Returns an object that contains the list of workflows IDs',
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
            const response = await this.workflowServiceApi.workflowServiceListWorkflows(this.argoNamespace, opts)
            const result = []

            response.body.items.forEach(element => {
                result.push(element.metadata.name)
            });
            
            return JSON.stringify(result)
        }catch(e) {
            Logger.error(`Error trying to get the list of status: ${e}`);
            throw new InternalServerErrorException(`There was an error trying to get the list of workflows of namespace ${this.argoNamespace}`);
        }           
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

        Logger.debug(`Getting information about workflow ${workflowID}`)

        try {
            const response = await this.workflowServiceApi.workflowServiceGetWorkflow(this.argoNamespace, workflowID, {})
            return response.body.metadata
        }catch(e) {
            Logger.error(`Error trying to get information about workflow ${workflowID}. Error: ${e}`)
            throw new NotFoundException(`Workflow ${workflowID} not found`)
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
        
        Logger.debug(`Getting status about workflow ${workflowID}`)
        let response

        try {
             response = await this.workflowServiceApi.workflowServiceGetWorkflow(this.argoNamespace, workflowID, {})
        }catch(e) {
            Logger.error(`Error trying to get status about workflow ${workflowID}. Error: ${e}`)
            throw new NotFoundException(`Workflow ${workflowID} not found`)
        }   

        try{     
            const status = this.computeService.createWorkflowStatus(response.body, workflowID)
            return JSON.stringify(status)

        }catch(e) {
            Logger.error(`Error trying to get status about workflow ${workflowID}. Error: ${e}`)
            throw new InternalServerErrorException(`Workflow ${workflowID} not found`)
        }   
        
    }

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

       try {

            let sampleWorkflow = this.computeService.readExample()

            const createParams = IoArgoprojWorkflowV1alpha1WorkflowCreateRequest.constructFromObject({ serverDryRun:false, namespace: this.argoNamespace, workflow: sampleWorkflow}, new IoArgoprojWorkflowV1alpha1WorkflowCreateRequest())
            const response = await this.workflowServiceApi.workflowServiceCreateWorkflow( createParams, this.argoNamespace)
            Logger.debug("Argo Workflow created: " + JSON.stringify(response.body))
            return response.body.metadata.name

        }catch(e) {
            Logger.error(`Problem initialing workflow for service Agreement ${initData.agreementId}. Error: ${e}`)
            throw new InternalServerErrorException(`Problem initialing workflow for service Agreement ${initData.agreementId}`)
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

        Logger.debug(`Deleting workflow ${workflowID}`)

        try {
            const opts = {
                deleteOptionsGracePeriodSeconds: "60",
                deleteOptionsOrphanDependents: "true",
                deleteOptionsPropagationPolicy: 'propagation_policy_example'
            }
            const response = await this.workflowServiceApi.workflowServiceDeleteWorkflow(this.argoNamespace, workflowID, opts)
            return response.data

        }catch(e) {
            Logger.error(`Error trying delete workflow ${workflowID}. Error: ${e}`)
            throw new InternalServerErrorException(`Error trying delete workflow  ${workflowID}`)
        }   
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


  }