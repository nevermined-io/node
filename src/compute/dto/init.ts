import { ApiProperty } from "@nestjs/swagger";
import {  IsString } from "class-validator";

export class InitDto {
    @ApiProperty({
      description: 'The agreement for Compute Workflow DDO',
      example: '0x...'
    })
    @IsString()
    agreementId: string;

  
    @ApiProperty({
      description: 'A Serialized Compute Workflow DDO',
      example: ''
    })
    @IsString()
    computeDdoString: string;
  }