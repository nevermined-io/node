import { ApiProperty } from '@nestjs/swagger';

export class ExecuteWorkflowResultDto {
  @ApiProperty({
    description: 'The workflowId executed',
    example: 'nevermined-compute-q9rld',
  })
  workflowId: string;
}
