import { Module } from '@nestjs/common';
import { EncryptController } from './encrypt.controller';

@Module({
  imports: [],
  providers: [],
  controllers: [EncryptController],
  exports: [],
})
export class EncryptModule {}
