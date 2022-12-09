import { ApiProperty } from '@nestjs/swagger';

export class StopWorkflowResultDto {
  @ApiProperty({
    description: 'status of the request',
    example: '200',
  })
  status: number;

  @ApiProperty({
    description: 'text explaining result',
    example: 'workflow nevermined-compute-9lw24 successfuly deleted`',
  })
  text: string;
}
