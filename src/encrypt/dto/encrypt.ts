import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class EncryptDto {
  @ApiProperty({
    example: 'PSK-ECDSA',
    description: 'Encryption method',
  })
  @IsString()
  method: string;
  @ApiProperty({
    example: 'Hello!',
    description: 'Encrypted message',
  })
  @IsString()
  message: string;
}
