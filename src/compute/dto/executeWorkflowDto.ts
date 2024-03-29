import { ApiProperty } from '@nestjs/swagger'
import { IsString } from 'class-validator'

export class ExecuteWorkflowDto {
  @ApiProperty({
    description: 'The Did for the Compute Workflow DDO',
    example: 'did:nv:e12092c13c408ade77f16bfbfb279c04fdcfb75eb5f9a4464a1d77db4c613652',
  })
  @IsString()
  workflowDid: string

  @ApiProperty({
    description: 'The address of the consumer of the compute result',
    example: '0xe2DD09d719Da89e5a3D0F2549c7E24566e947260',
  })
  @IsString()
  consumer: string
}
