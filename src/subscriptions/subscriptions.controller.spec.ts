import { Test, TestingModule } from '@nestjs/testing'
import { ConfigModule } from '../shared/config/config.module'
import { NeverminedModule } from '../shared/nevermined/nvm.module'
import { SubscriptionsController } from './subscriptions.controller'
import { SubscriptionsService } from './subscriptions.service'

describe('SubscriptionsController', () => {
  let controller: SubscriptionsController

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [SubscriptionsController],
      providers: [SubscriptionsService],
      imports: [NeverminedModule, ConfigModule],
    }).compile()

    controller = moduleRef.get<SubscriptionsController>(SubscriptionsController)
  })

  it('should be defined', () => {
    expect(controller).toBeDefined()
  })
})
