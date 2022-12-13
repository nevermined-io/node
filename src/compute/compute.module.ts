import { Module } from '@nestjs/common'
import { ConfigService } from '../shared/config/config.service'
import { NeverminedModule } from '../shared/nevermined/nvm.module'
import { ComputeController } from './compute.controller'
import { ComputeService } from './compute.service'

@Module({
  providers: [ComputeService, ConfigService],
  imports: [NeverminedModule],
  controllers: [ComputeController],
  exports: [],
})
export class ComputeModule {}
