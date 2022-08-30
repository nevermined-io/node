import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ApplicationModule } from '../src/app.module';
import * as path from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';
import { writeFileSync } from 'fs';
import { readFileSync } from 'fs';

const bootstrap = async () => {

  const app = await NestFactory.create<NestExpressApplication>(ApplicationModule, { cors: true });
  app.enable('trust proxy');

  const packageJsonPath = path.join(__dirname, '..', 'package.json');
  const packageJsonString = readFileSync(packageJsonPath, 'utf8');
  const packageJson = JSON.parse(packageJsonString) as { version: string };

  const options = new DocumentBuilder()
    .setTitle('Nevermined Gateway')
    .setVersion(packageJson.version)
    .addBearerAuth(
      {
        type: 'http',
      },
      'Authorization'
    )
    .build();
  const document = SwaggerModule.createDocument(app, options);
  writeFileSync('docs/openapi.json', JSON.stringify(document), { encoding: 'utf8'});

  await app.close();
};

bootstrap()