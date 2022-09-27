import { ApiProperty } from "@nestjs/swagger";

export class UploadResult {
    @ApiProperty({
      description: 'Url of the uploaded file',
      example: 'cid://bawoeijdoidewj',
      required: true,
    })
    url: string;
    @ApiProperty({
      description: 'Password for encrypted file',
      example: '1234#',
    })
    password?: string;
}
  