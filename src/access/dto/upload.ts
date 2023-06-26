import { ApiProperty } from '@nestjs/swagger'
import { IsString } from 'class-validator'

export class UploadDto {
  @ApiProperty({
    description: 'Encrypt uploaded data',
    example: 'false',
    required: false,
  })
  encrypt: string
  @ApiProperty({
    example: 'Hello!',
    description: 'Message to upload',
    required: false,
  })
  @IsString()
  message: string
}
