import { Module } from '@nestjs/common'
import { ConfigModule } from '../shared/config/config.module'
import { NeverminedModule } from '../shared/nevermined/nvm.module'
import { SubscriptionsController } from './subscriptions.controller'
import { SubscriptionsService } from './subscriptions.service'

@Module({
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService],
  imports: [NeverminedModule, ConfigModule],
})
export class SubscriptionsModule {}
