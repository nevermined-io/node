import { ApiProperty } from "@nestjs/swagger";
import { string } from "joi";

export class UploadDto {
    @ApiProperty({
      description: 'Encrypt uploaded data',
      example: 'false',
      required: false,
    })
    encrypt: string;    
    @ApiProperty({
      type: string,
      example: 'Hello!',
      description: 'Message to upload',
      required: false,
    })
    message: string;
}
