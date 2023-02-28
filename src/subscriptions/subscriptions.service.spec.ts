import { Test, TestingModule } from '@nestjs/testing'
import { SubscriptionsService } from './subscriptions.service'

describe('SubscriptionsService', () => {
  let service: SubscriptionsService

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [SubscriptionsService],
    }).compile()

    service = moduleRef.get<SubscriptionsService>(SubscriptionsService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })
})
