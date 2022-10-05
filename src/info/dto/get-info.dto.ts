import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUrl } from 'class-validator';

export class GetInfoDto {

  @ApiProperty({
    example: '1.0.4',
    description: 'Marketplace API Version',
  })
  @IsString()
  APIversion: string;

  @ApiProperty({
    example: 'http://localhost:3100/api/v1/docs',
    description: 'API docs url',
  })
  @IsUrl({
    require_tld: false,
  })
  docs: string;
  network: string;
  'keeper-url': string;
  'provenance-enabled': boolean;
  'artifacts-folder': string;
  contracts: any;
  'external-contracts': any;
  'keeper-version': string;
  'provider-address': string;
  'ecdsa-public-key': string;
  'rsa-public-key': string;
  'babyjub-public-key': {x: string, y:string};
}
