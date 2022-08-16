import { INestApplication } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { JwtAuthGuard } from '../common/guards/auth/jwt-auth.guard';
import { InfoController } from './info.controller';
import request from 'supertest';

describe('Info', () => {
  let app: INestApplication;
  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
        imports: [],
        providers: [],
        controllers: [InfoController],
        exports: [],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalGuards(new JwtAuthGuard(new Reflector()));
    await app.init();
  })
  it('/GET info', async () => {
    const response = await request(app.getHttpServer()).get(`/`);

    expect(response.statusCode).toBe(200);
    expect(response.body['keeper-url']).toBe('http://localhost:8545');
  });
})
