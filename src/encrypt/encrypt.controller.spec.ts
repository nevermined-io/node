import { INestApplication, ValidationPipe } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { Test } from '@nestjs/testing'
import { JwtAuthGuard } from '../common/guards/auth/jwt-auth.guard'
import { EncryptController } from './encrypt.controller'
import request from 'supertest'
import { ConfigModule } from '../shared/config/config.module'
import { ConfigService } from '../shared/config/config.service'
import { accountFromCredentialsFile, decrypt } from '../common/helpers/encryption.helper'

/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */

describe('Info', () => {
  let app: INestApplication
  const config = new ConfigService()
  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule],
      providers: [],
      controllers: [EncryptController],
      exports: [],
    }).compile()
    app = moduleRef.createNestApplication()
    app.useGlobalPipes(new ValidationPipe())
    app.useGlobalGuards(new JwtAuthGuard(new Reflector()))
    await app.init()
  })
  it('no params', async () => {
    const response = await request(app.getHttpServer()).post(`/`)
    expect(response.statusCode).toBe(400)
    expect((response.error as any).text).toContain('must be a string')
  })
  it('bad method', async () => {
    const response = await request(app.getHttpServer())
      .post(`/`)
      .send({ message: 'msg', method: 'foo' })
    expect(response.statusCode).toBe(400)
    expect((response.error as any).text).toContain('Only PSK-ECDSA or PSK-RSA encryption allowed')
  })
  it('correct call', async () => {
    const response = await request(app.getHttpServer())
      .post(`/`)
      .send({ message: 'msg', method: 'PSK-RSA' })
    expect(response.statusCode).toBe(201)
    expect(response.body.method).toBe('PSK-RSA')
    const result = response.body.hash
    expect(await decrypt(config.cryptoConfig(), result, 'PSK-RSA')).toBe('msg')
  })

  it('load NvmAccount from credentials file', async () => {
    const account = await accountFromCredentialsFile(
      process.env.PROVIDER_KEYFILE,
      process.env.PROVIDER_PASSWORD,
    )
    expect(account).toBeDefined()
    console.log(account.getAddress())
    expect(account.getAddress()).toBeDefined()
    expect(account.getType()).toBe('local')
  })
})
