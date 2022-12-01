import { ApiProperty } from '@nestjs/swagger'
import { Equals, IsJWT } from 'class-validator'
import { CLIENT_ASSERTION_TYPE } from '../../common/guards/shared/jwt.utils'

export class ClientAssertionDto {
  @ApiProperty({
    description: `Type type of JWT client assertion. Must be ${CLIENT_ASSERTION_TYPE}`,
    example: CLIENT_ASSERTION_TYPE,
  })
  @Equals(CLIENT_ASSERTION_TYPE)
  grant_type: string

  @ApiProperty({
    description: 'A single JWT',
    example: 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjIyIn0.eyJpc3Mi[...omitted for brevity...]',
  })
  @IsJWT()
  assertion: string
}
