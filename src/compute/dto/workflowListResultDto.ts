import { ApiProperty } from '@nestjs/swagger';

export class WorkflowListResultDto {
  @ApiProperty({
    description: 'Array with workflowsId',
    example: '["workflowId": "nevermined-compute-q9rld", "workflowId": "nevermined-compute-jf9gf"]',
  })
  workflows: { workflowId: string }[];
}
