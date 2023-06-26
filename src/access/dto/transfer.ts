import { ApiProperty } from '@nestjs/swagger'
import { IsNumber, IsOptional, IsString } from 'class-validator'

export class TransferDto {
  @ApiProperty({
    description: 'The agreement for NFT transfer',
    example: '0x...',
  })
  @IsString()
  agreementId: string

  @ApiProperty({
    description: 'The asset DID',
    example: 'did:nv:aaa',
  })
  @IsOptional()
  @IsString()
  did: string

  @ApiProperty({
    description: 'NFT holder address',
    example: '0x...',
  })
  @IsString()
  nftHolder: string

  @ApiProperty({
    description: 'NFT receiver address',
    example: '0x...',
  })
  @IsString()
  nftReceiver: string

  @ApiProperty({
    description: 'Number of NFTs to transfer',
    example: '1',
  })
  @IsString()
  nftAmount: string

  @ApiProperty({
    description: 'Type of NFT',
    example: '721',
  })
  @IsNumber()
  nftType: number
}
