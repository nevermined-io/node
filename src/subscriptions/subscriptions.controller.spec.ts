import { Test, TestingModule } from '@nestjs/testing'
import { SubscriptionsController } from './subscriptions.controller'

describe('SubscriptionsController', () => {
  let controller: SubscriptionsController

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [SubscriptionsController],
    }).compile()

    controller = moduleRef.get<SubscriptionsController>(SubscriptionsController)
  })

  it('should be defined', () => {
    expect(controller).toBeDefined()
  })
})
