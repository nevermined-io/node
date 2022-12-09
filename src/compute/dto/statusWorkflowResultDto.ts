import { ApiProperty } from '@nestjs/swagger'
import { WorkflowStatus } from '../compute.service'

export class StatusWorkflowResultDto {
  @ApiProperty({
    description: 'Status of the workflow',
    example:
      '{"status":"Succeeded","startedAt":"2022-11-30T08:34:12Z","finishedAt":"2022-11-30T08:34:38Z","pods":[]}',
  })
  workflowStatus: WorkflowStatus
}
