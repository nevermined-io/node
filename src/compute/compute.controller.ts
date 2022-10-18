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
  //import { DDO } from "@nevermined-io/nevermined-sdk-js";
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
  
    /*
    constructor(private nvmService: NeverminedService,
                private computeService: ComputeService) {}
                */

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

            let result 
            let pods = []
               
            // Transform from tuple objects to array
            const nodesTuples = response.body.status.nodes
            var nodesArray = []
            for (var i in nodesTuples){
                nodesArray.push(nodesTuples[i])
            }

            nodesArray.forEach((element) => {
                const podName = element.displayName
                if (podName === workflowID){
                    result = {
                        "status": element.phase,
                        "startedAt": element.startedAt,
                        "finishedAt": element.finishedAt,         
                        "did": undefined,
                        "pods": []
                    }
                }
                else {
                    const statusMessage = {
                        "podName": podName,
                        "status": element.phase,
                        "startedAt": element.startedAt,
                        "finishedAt": element.finishedAt || undefined            
                    }
                    pods.push(statusMessage)
                }          
            })

            result = {...result, pods: pods}
            // TODO look for did
            if (result.status === 'Succeeded'){
                result = {...result, did:"did:nv:xxxxx"}
                /*
                      ddo = nevermined.assets.search(f'"{execution_id}"')[0]
                      result["did"] = ddo.did
                */
            }
            
            return JSON.stringify(result)

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

        let sampleWorkflow = this.computeService.readWorkflowTemplate()
        const createParams = IoArgoprojWorkflowV1alpha1WorkflowCreateRequest.constructFromObject({ namespace: this.argoNamespace, workflow: sampleWorkflow}, new IoArgoprojWorkflowV1alpha1WorkflowCreateRequest())
        const response = await this.workflowServiceApi.workflowServiceCreateWorkflow( createParams, "argo")
        return response.body

        //const ddo: DDO = DDO.deserialize(initData.computeDdoString)
       
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


  }