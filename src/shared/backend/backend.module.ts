import { Module } from '@nestjs/common'
import { HttpModule } from '@nestjs/axios'
import { BackendService } from './backend.service'
import { ConfigModule } from '../config/config.module'

@Module({
  imports: [ConfigModule, HttpModule],
  providers: [BackendService],
  exports: [BackendService],
})
export class BackendModule {}
