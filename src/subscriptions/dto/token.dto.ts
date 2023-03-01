import { ApiProperty } from '@nestjs/swagger'
import { IsString } from 'class-validator'

export class SubscriptionTokenDto {
  @ApiProperty({
    description: 'The Authorization Bearer token',
    example: 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjIyIn0.eyJpc3Mi[...omitted for brevity...]',
  })
  @IsString()
  accessToken: string

  @ApiProperty({
    description: 'The proxy uri that should be used with the provided token',
    example: 'https://proxy.nevermined.one',
  })
  @IsString()
  neverminedProxyUri: string
}
