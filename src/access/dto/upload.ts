import { ApiProperty } from "@nestjs/swagger"

export class UploadDto {
    @ApiProperty({
      description: 'Encrypt uploaded data',
      example: 'false',
      required: false,
    })
    encrypt: string
}
