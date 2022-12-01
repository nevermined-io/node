import { Module } from '@nestjs/common'
import { ConfigModule } from '../shared/config/config.module'
import { EncryptController } from './encrypt.controller'

@Module({
  imports: [ConfigModule],
  providers: [],
  controllers: [EncryptController],
  exports: [],
})
export class EncryptModule {}
