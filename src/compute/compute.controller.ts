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
  import { ComputeService } from './compute.service'
  import { InitDto } from "./dto/init";
  import { Logger } from '../shared/logger/logger.service';
  import { ConfigService } from  '../shared/config/config.service'
  import {WorkflowServiceApi} from '@nevermined-io/argo-workflows-api'

  const yaml = require('js-yaml');

  @ApiTags('Compute')
  @Controller()
  export class ComputeController {

    constructor(private computeService: ComputeService,
                private configService: ConfigService)
    {}
    
    private argoNamespace = this.configService.computeConfig().argo_namespace
    private argoWorkflowApi= new WorkflowServiceApi({ basePath: this.configService.computeConfig().argo_host}) 

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
            
            const response = await this.argoWorkflowApi.workflowServiceListWorkflows(this.argoNamespace)
            const result = []

            response.data.items.forEach(element => {
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
            const response = await this.argoWorkflowApi.workflowServiceGetWorkflow(this.argoNamespace, workflowID)
            return JSON.stringify(response.data.metadata)
            
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
            response = await this.argoWorkflowApi.workflowServiceGetWorkflow(this.argoNamespace, workflowID)
        }catch(e) {
            Logger.error(`Error trying to get status about workflow ${workflowID}. Error: ${e}`)
            throw new NotFoundException(`Workflow ${workflowID} not found`)
        }   

        try{     
            const status = this.computeService.createWorkflowStatus(response.data, workflowID)
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

            // TODO. Replace for NVM Compute workflow
            //let argoWorkflow = this.computeService.readExample()
            let argoWorkflow = await this.computeService.createArgoWorkflow(initData)
            return JSON.stringify(argoWorkflow)

            /*
            const response = await this.argoWorkflowApi.workflowServiceCreateWorkflow( { serverDryRun:false, namespace: this.argoNamespace, workflow: argoWorkflow}, this.argoNamespace)
            Logger.debug("Argo Workflow created:: " + JSON.stringify(response.data))
            return response.data.metadata.name
            */

        }catch(e) {
            Logger.error(`Problem initialing workflow for service Agreement ${initData.agreementId}. Error: ${e}`)
            throw new InternalServerErrorException(`Problem initialing workflow for service Agreement ${initData.agreementId}`)
        }         
    }
    

    // TODO - after testing, define the endpoint as DELETE op
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
            
            const deleteOptionsGracePeriodSeconds =  '60'
            const deleteOptionsOrphanDependents = true
            const deleteOptionsPropagationPolicy= 'propagation_policy_example'
            const response = await this.argoWorkflowApi.workflowServiceDeleteWorkflow(this.argoNamespace, workflowID, deleteOptionsGracePeriodSeconds, undefined, undefined, deleteOptionsOrphanDependents, deleteOptionsPropagationPolicy)
           
            return JSON.stringify({status: response.status, text: `workflow ${workflowID} successfuly deleted`})

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