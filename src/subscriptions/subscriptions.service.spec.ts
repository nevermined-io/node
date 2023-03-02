import { Test, TestingModule } from '@nestjs/testing'
import { ConfigModule } from '../shared/config/config.module'
import { NeverminedModule } from '../shared/nevermined/nvm.module'
import { SubscriptionsService } from './subscriptions.service'

describe('SubscriptionsService', () => {
  let service: SubscriptionsService

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [SubscriptionsService],
      imports: [NeverminedModule, ConfigModule],
    }).compile()

    service = moduleRef.get<SubscriptionsService>(SubscriptionsService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })
})
