import { INestApplication } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { Test } from '@nestjs/testing'
import { JwtAuthGuard } from '../common/guards/auth/jwt-auth.guard'
import { InfoController } from './info.controller'
import request from 'supertest'
import { ConfigModule } from '../shared/config/config.module'
import { NeverminedModule } from '../shared/nevermined/nvm.module'

describe('Info', () => {
  let app: INestApplication
  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule, NeverminedModule],
      providers: [],
      controllers: [InfoController],
      exports: [],
    }).compile()
    app = moduleRef.createNestApplication()
    app.useGlobalGuards(new JwtAuthGuard(new Reflector()))
    await app.init()
  })
  it('/GET info', async () => {
    const response = await request(app.getHttpServer()).get(`/`)

    expect(response.statusCode).toBe(200)
    // eslint-disable-next-line
    expect(response.body['keeper-url']).toBe('http://localhost:8545')
  })
})
