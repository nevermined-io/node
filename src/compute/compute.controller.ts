import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Delete,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common'
import { ApiOperation, ApiResponse, ApiTags, ApiBearerAuth, ApiInternalServerErrorResponse, ApiNotFoundResponse} from '@nestjs/swagger'
import { Public } from '../common/decorators/auth.decorator'
import { ComputeService } from './compute.service'
import { ExecuteWorkflowDto } from './dto/executeWorkflowDto'
import { WorkflowListResultDto } from './dto/workflowListResultDto'
import { ExecuteWorkflowResultDto } from './dto/executeWorkflowResultDto'
import { StatusWorkflowResultDto } from './dto/statusWorkflowResultDto'
import { StopWorkflowResultDto } from './dto/stopWorkflowResultDto'
import { LogsWorkflowResultDto } from './dto/logsWorkflowResultDto'
import { Logger } from '../shared/logger/logger.service'
import { ConfigService } from '../shared/config/config.service'
import { WorkflowServiceApi } from '@nevermined-io/argo-workflows-api'

@ApiTags('Compute')
@Controller()
export class ComputeController {
  constructor(private computeService: ComputeService, private configService: ConfigService) {}

  private argoNamespace = this.configService.computeConfig().argo_namespace
  private argoWorkflowApi = new WorkflowServiceApi({
    basePath: this.configService.computeConfig().argo_host,
  })
  private getAuthorizationHeaderOption: { headers: { Authorization: string } } | any =
    this.configService.computeConfig().argo_auth_token
      ? {
          headers: { Authorization: this.configService.computeConfig().argo_auth_token },
        }
      : {}

  @Get('list')
  @ApiOperation({
    description: 'List of workflows',
    summary: 'Returns a list of all executed workflows',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns an object that contains the list of workflows IDs',
    type: WorkflowListResultDto,
  })
  @ApiInternalServerErrorResponse({
    status: 500,
    description: 'Error getting list of workflows from Argo Workflow',
    type: InternalServerErrorException
  })
  @Public()
  async getWorkflowsList(): Promise<WorkflowListResultDto> {
    Logger.debug(`Getting list of workflows`)

    try {
      const response = await this.argoWorkflowApi.workflowServiceListWorkflows(
        this.argoNamespace,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        this.getAuthorizationHeaderOption,
      )
      const result = []

      if (response.data.items) {
        response.data.items.forEach((element) => {
          result.push(element.metadata.name)
        })
      }

      return { workflows: result }
    } catch (e) {
      Logger.error(`Error trying to get the list of workflows: ${e}`)
      throw new InternalServerErrorException(
        `There was an error trying to get the list of workflows of namespace ${this.argoNamespace}`,
      )
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
    type: StatusWorkflowResultDto,
  })
  @ApiInternalServerErrorResponse({
    status: 500,
    description: 'Error processing status from Argo Workflows',
    type: InternalServerErrorException
  })
  @ApiNotFoundResponse({
    status: 404,
    description: 'workflow not found in Argo Workflow',
    type: NotFoundException
  })
  @ApiBearerAuth('Authorization')
  async getWorkflowStatus(
    @Param('workflowID') workflowID: string,
  ): Promise<StatusWorkflowResultDto> {
    let response
    try {
      response = await this.argoWorkflowApi.workflowServiceGetWorkflow(
        this.argoNamespace,
        workflowID,
        undefined,
        undefined,
        this.getAuthorizationHeaderOption,
      )
    } catch (e) {
      Logger.error(`Error trying to get status about workflow ${workflowID}. Error: ${e}`)
      throw new NotFoundException(`Workflow ${workflowID} not found`)
    }

    try {
      const status = await this.computeService.createWorkflowStatus(response.data, workflowID)
      return { workflowStatus: status }
    } catch (e) {
      Logger.error(`Error trying to get status about workflow ${workflowID}. Error: ${e}`)
      throw new InternalServerErrorException(`Workflow ${workflowID} not found`)
    }
  }

  @Post('execute/:agreement_id')
  @ApiOperation({
    description: 'Execute compute',
    summary: 'Starts the execution of a compute workflow',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns the Workflow ID',
    type: ExecuteWorkflowResultDto,
  })
  @ApiInternalServerErrorResponse({
    status: 500,
    description: 'Error creating a new workflow in  Argo Workflows',
    type: InternalServerErrorException
  })
  @ApiBearerAuth('Authorization')
  async initCompute(
    @Body() initData: ExecuteWorkflowDto,
    @Param('agreement_id') agreementId: string,
  ): Promise<ExecuteWorkflowResultDto> {
    try {
      Logger.debug(`Executing compute for agreement id ${agreementId}`)

      const argoWorkflow = await this.computeService.createArgoWorkflow(initData, agreementId)
      const response = await this.argoWorkflowApi.workflowServiceCreateWorkflow(
        { serverDryRun: false, namespace: this.argoNamespace, workflow: argoWorkflow },
        this.argoNamespace,
        this.getAuthorizationHeaderOption,
      )

      Logger.debug('Argo Workflow created with id: ' + JSON.stringify(response.data.metadata.name))
      return { workflowId: response.data.metadata.name }
    } catch (e) {
      Logger.error(`Problem initialing workflow for service Agreement ${agreementId}. Error: ${e}`)
      throw new InternalServerErrorException(
        `Problem initialing workflow for service Agreement ${agreementId}`,
      )
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
    type: StopWorkflowResultDto,
  })
  @ApiInternalServerErrorResponse({
    status: 500,
    description: 'Error stopping a workflow in Argo Workflows',
    type: InternalServerErrorException
  })
  @ApiBearerAuth('Authorization')
  async stopWorkflowExecution(
    @Param('workflowID') workflowID: string,
  ): Promise<StopWorkflowResultDto> {
    Logger.debug(`Deleting workflow ${workflowID}`)

    try {
      const deleteOptionsGracePeriodSeconds = '60'
      const deleteOptionsOrphanDependents = true
      const deleteOptionsPropagationPolicy = 'propagation_policy_example'
      const response = await this.argoWorkflowApi.workflowServiceDeleteWorkflow(
        this.argoNamespace,
        workflowID,
        deleteOptionsGracePeriodSeconds,
        undefined,
        undefined,
        deleteOptionsOrphanDependents,
        deleteOptionsPropagationPolicy,
        undefined,
        undefined,
        this.getAuthorizationHeaderOption,
      )

      return { status: response.status, text: `workflow ${workflowID} successfuly deleted` }
    } catch (e) {
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
    type: LogsWorkflowResultDto,
  })
  @ApiBearerAuth('Authorization')
  async getWorkflowExecutionLogs(
    @Param('workflowID') workflowID: string,
  ): Promise<LogsWorkflowResultDto> {
    const response = await this.argoWorkflowApi.workflowServiceWorkflowLogs(
      this.argoNamespace,
      workflowID,
      undefined,
      'main',
      undefined,
      true,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      this.getAuthorizationHeaderOption,
    )

    Logger.debug(`LOGS: ${response.data}`)

    return { logs: response.data }
  }
}
