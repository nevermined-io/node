import { ApiProperty } from '@nestjs/swagger';

export class LogsWorkflowResultDto {
  @ApiProperty({
    description: 'logs of the workflow',
    example: '200',
  })
  // TODO. Pending to define until fix bug with logs
  logs: any;
}
