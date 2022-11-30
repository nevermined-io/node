import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { JwtAuthGuard } from '../common/guards/auth/jwt-auth.guard';
import { AccessController } from './access.controller';
import { NeverminedModule } from '../shared/nevermined/nvm.module';
import request from 'supertest';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from '../auth/auth.service.mock';
import { JwtStrategy } from '../common/strategies/jwt.strategy';
import { ConfigModule } from '../shared/config/config.module';

/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */

describe('Info', () => {
  let app: INestApplication;
  let authService: AuthService;
  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        NeverminedModule,
        ConfigModule,
        PassportModule,
        JwtModule.register({
          secret: 'secret',
          signOptions: { expiresIn: '60m' },
        }),
      ],
      providers: [
        AuthService,
        JwtStrategy,
      ],
      controllers: [AccessController],
      exports: [],
    }).compile();
    app = moduleRef.createNestApplication();
    authService = moduleRef.get<AuthService>(AuthService);
    app.useGlobalPipes(new ValidationPipe());
    app.useGlobalGuards(new JwtAuthGuard(new Reflector()));
    await app.init();
  });
  it('no DID', async () => {
    const response = await request(app.getHttpServer())
      .get(`/access/0x/123`)
      .set('Authorization', `Bearer ${await authService.createToken({})}`);
    expect((response.error as any).text).toContain('DID not specified');
  });
  it('access / unknown asset', async () => {
    const response = await request(app.getHttpServer())
      .get(`/access/0x/123`)
      .set(
        'Authorization', 
        `Bearer ${await authService.createToken({did:"did:nv:0ebed8226ada17fde24b6bf2b95d27f8f05fcce09139ff5cec31f6d81a7cd2ea"})}`
      );
    expect((response.error as any).text).toContain('No such DID');
  });
  it('download / unknown asset', async () => {
    const response = await request(app.getHttpServer())
      .get(`/download/123`)
      .set(
        'Authorization', 
        `Bearer ${await authService.createToken({did:"did:nv:0ebed8226ada17fde24b6bf2b95d27f8f05fcce09139ff5cec31f6d81a7cd2ea"})}`
      );
    expect((response.error as any).text).toContain('No such DID');
  });
  it('nft-access / unknown asset', async () => {
    const response = await request(app.getHttpServer())
      .get(`/nft-access/0x/123`)
      .set(
        'Authorization', 
        `Bearer ${await authService.createToken({did:"did:nv:0ebed8226ada17fde24b6bf2b95d27f8f05fcce09139ff5cec31f6d81a7cd2ea"})}`
      );
    expect((response.error as any).text).toContain('No such DID');
  });
  it('nft-transfer / no post data', async () => {
    const response = await request(app.getHttpServer())
      .post(`/nft-transfer`);
    expect((response.error as any).text).toContain('must be a string');
  });
  it('nft-transfer / unknown agreement', async () => {
    const response = await request(app.getHttpServer())
      .post(`/nft-transfer`)
      .send({
        nftType: 1155,
        agreementId: '0ebed8226ada17fde24b6bf2b95d27f8f05fcce09139ff5cec31f6d81a7cd2ea',
        nftReceiver: '0x123',
        nftHolder: '0x123',
        nftAmount: "1"
      });
    expect(response.statusCode).toBe(404);
    expect((response.error as any).text).toContain('Agreement');
  });
  it('upload / no params', async () => {
    const response = await request(app.getHttpServer())
      .post(`/upload/ipfs`);
    expect(response.statusCode).toBe(400);
    expect((response.error as any).text).toContain('No file or message');
  });
  it('upload wrong backend', async () => {
    const response = await request(app.getHttpServer())
      .post(`/upload/wrong`)
      .send({
        message: 'hi there'
      });
    expect(response.statusCode).toBe(400);
    expect((response.error as any).text).toContain('Backend wrong not supported');
  });
  it('upload ipfs', async () => {
    const response = await request(app.getHttpServer())
      .post(`/upload/ipfs`)
      .send({
        message: 'hi there'
      });
    expect(response.statusCode).toBe(201);
    expect(response.body.url).toContain('cid://');
  });  
});
