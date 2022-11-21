import { 
    Body, 
    Controller,
    Get,  
    Param, 
    Post,
    Delete, 
    NotFoundException,
    InternalServerErrorException,
  } from "@nestjs/common";
  import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
  import { Public } from "../common/decorators/auth.decorator";
  import { ComputeService } from './compute.service';
  import { InitDto } from "./dto/init";
  import { Logger } from '../shared/logger/logger.service';
  import { ConfigService } from  '../shared/config/config.service';
  import {WorkflowServiceApi} from '@nevermined-io/argo-workflows-api';

  @ApiTags('Compute')
  @Controller()
  export class ComputeController {

    constructor(private computeService: ComputeService,
                private configService: ConfigService)
    {}
    
    private argoNamespace = this.configService.computeConfig().argo_namespace;
    private argoWorkflowApi= new WorkflowServiceApi({ basePath: this.configService.computeConfig().argo_host}); 
    private getAuthorizationHeaderOption():{headers: {Authorization:string}} | any {
        return this.configService.computeConfig().argo_auth_token?{
            headers: { Authorization: this.configService.computeConfig().argo_auth_token }
        }:{}

    }


    @Post('test')
    @ApiOperation({
        description: 'Compute Init',
        summary: 'Start the execution of a compute workflow',
    })
    @ApiResponse({
        status: 200,
        description: 'Returns the Workflow ID',
        type: String,
    })
    // @ApiBearerAuth('Authorization')
   @Public()
    async initTest(): Promise<string> {

       try {

            const argoWorkflow = await this.computeService.readExample()
            const response = await this.argoWorkflowApi.workflowServiceCreateWorkflow( { serverDryRun:false, namespace: this.argoNamespace, workflow: argoWorkflow}, this.argoNamespace, this.getAuthorizationHeaderOption())
        
            Logger.debug("Argo Workflow created:: " + JSON.stringify(response.data))
            return response.data.metadata.name   

        }catch(e) {
            Logger.error(`Problem initialing test workflow. Error: ${e}`);
            throw new InternalServerErrorException(`Problem initialing  test workflow`);
        }         
    }



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
    // @ApiBearerAuth('Authorization')
   @Public()
    async getWorkflowsList(): Promise<string> {

        Logger.debug(`Getting list of workflows`);
       
        try {
            
            const response = await this.argoWorkflowApi.workflowServiceListWorkflows(this.argoNamespace, undefined,
                undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, this.getAuthorizationHeaderOption());
            const result = [];

            if (response.data.items){
                response.data.items.forEach(element => {
                    result.push(element.metadata.name);
                });
            }

            return JSON.stringify(result);       
            
        }catch(e) {
            Logger.error(`Error trying to get the list of workflows: ${e}`);
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
    // @ApiBearerAuth('Authorization')
   @Public()
    async getWorkflowInfo(
        @Param('workflowID') workflowID: string,
    ): Promise<string> {

        Logger.debug(`Getting information about workflow ${workflowID}`);

        try {
            const response = await this.argoWorkflowApi.workflowServiceGetWorkflow(this.argoNamespace, workflowID, undefined, undefined, this.getAuthorizationHeaderOption());
            console.log(JSON.stringify(response.data))
            return JSON.stringify(response.data.metadata);
            
        }catch(e) {
            Logger.error(`Error trying to get information about workflow ${workflowID}. Error: ${e}`);
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
    // @ApiBearerAuth('Authorization')
   @Public()
    async getWorkflowStatus(
        @Param('workflowID') workflowID: string,
    ): Promise<string> {
        
        Logger.debug(`Getting status about workflow ${workflowID}`);
        let response;

        try {
            response = await this.argoWorkflowApi.workflowServiceGetWorkflow(this.argoNamespace, workflowID, undefined, undefined, this.getAuthorizationHeaderOption());
        }catch(e) {
            Logger.error(`Error trying to get status about workflow ${workflowID}. Error: ${e}`);
            throw new NotFoundException(`Workflow ${workflowID} not found`);
        }   

        try{     
            const status = await this.computeService.createWorkflowStatus(response.data, workflowID);
            return JSON.stringify(status);

        }catch(e) {
            Logger.error(`Error trying to get status about workflow ${workflowID}. Error: ${e}`);
            throw new InternalServerErrorException(`Workflow ${workflowID} not found`);
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
   // @ApiBearerAuth('Authorization')
   @Public()
    async initCompute(
        @Body() initData: InitDto,
    ): Promise<string> {

       try {

            const argoWorkflow = await this.computeService.createArgoWorkflow(initData)
            const response = await this.argoWorkflowApi.workflowServiceCreateWorkflow( { serverDryRun:false, namespace: this.argoNamespace, workflow: argoWorkflow}, this.argoNamespace, this.getAuthorizationHeaderOption())
        
            Logger.debug("Argo Workflow created:: " + JSON.stringify(response.data))
            return response.data.metadata.name   

        }catch(e) {
            Logger.error(`Problem initialing workflow for service Agreement ${initData.agreementId}. Error: ${e}`);
            throw new InternalServerErrorException(`Problem initialing workflow for service Agreement ${initData.agreementId}`);
        }         
    }
    
    @Delete('stop/:workflowID')
    @ApiOperation({
        description: 'Stop',
        summary: 'Stop the execution of a workflow',
    })
    @ApiResponse({
        status: 200,
        description: 'Returns a success message',
        type: String,
    })
    // @ApiBearerAuth('Authorization')
   @Public()
    async stopWorkflowExecution(
        @Param('workflowID') workflowID: string,
    ): Promise<string> {

        Logger.debug(`Deleting workflow ${workflowID}`);

        try {
            
            const deleteOptionsGracePeriodSeconds =  '60';
            const deleteOptionsOrphanDependents = true;
            const deleteOptionsPropagationPolicy= 'propagation_policy_example';
            const response = await this.argoWorkflowApi.workflowServiceDeleteWorkflow(this.argoNamespace, workflowID, deleteOptionsGracePeriodSeconds, undefined, undefined, 
                deleteOptionsOrphanDependents, deleteOptionsPropagationPolicy, undefined, undefined, this.getAuthorizationHeaderOption());
           
            return JSON.stringify({status: response.status, text: `workflow ${workflowID} successfuly deleted`});

        }catch(e) {
            Logger.error(`Error trying delete workflow ${workflowID}. Error: ${e}`);
            throw new InternalServerErrorException(`Error trying delete workflow  ${workflowID}`);
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
    // @ApiBearerAuth('Authorization')
   @Public()
    async getWorkflowExecutionLogs(
        @Param('workflowID') workflowID: string,
    ): Promise<string> {

        //const response = await this.argoWorkflowApi.workflowServiceWorkflowLogs(this.argoNamespace, workflowID, "publishing", undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined,
         //   undefined, undefined,undefined, this.getAuthorizationHeaderOption())


        const response = await this.argoWorkflowApi.workflowServicePodLogs(this.argoNamespace, workflowID, "publishing", undefined, undefined, undefined, undefined, undefined,
            undefined, undefined, undefined, undefined, true, undefined, undefined, this.getAuthorizationHeaderOption())

        Logger.debug(`LOGS: ${JSON.stringify(response.data)}`)


        return JSON.stringify(response.data)
    }


  }