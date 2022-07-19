import { Module } from '@nestjs/common';
import { EncryptController } from './encrypt.controller';

@Module({
  providers: [],
  controllers: [EncryptController],
  exports: [],
})
export class InfoModule {}
