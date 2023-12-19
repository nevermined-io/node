import { Module } from '@nestjs/common'
import { NeverminedModule } from '../shared/nevermined/nvm.module'
import { BackendModule } from '../shared/backend/backend.module'
import { AccessController } from './access.controller'

@Module({
  providers: [],
  imports: [NeverminedModule, BackendModule],
  controllers: [AccessController],
  exports: [],
})
export class AccessModule {}
