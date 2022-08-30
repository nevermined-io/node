import { ValidationPipe } from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { readFileSync } from 'fs';
import path from 'path';
import { ApplicationModule } from './app.module';
import { JwtAuthGuard } from './common/guards/auth/jwt-auth.guard';
import { RolesGuard } from './common/guards/auth/roles.guards';
import { ConfigService } from './shared/config/config.service';
import { Logger } from './shared/logger/logger.service';

const createIndexes = (app: NestExpressApplication) => {
  let connectionTries = 0;

  /* eslint @typescript-eslint/no-misused-promises: 0 */
  const tryConnectionInterval = setInterval(async () => {
    try {
      await Promise.all(
        [].map(
          async (service) => {
            const serviceInstance = app.get(service);
            const serviceIndexExits = await serviceInstance.checkIndex();

            if (!serviceIndexExits) {
              await serviceInstance.createIndex();
            }
          }
        )
      );
      Logger.log('Marketplace API is connected to ElasticSearch');
      clearInterval(tryConnectionInterval);
    } catch {
      Logger.log('Error to connect to ElasticSearch. Trying in 10s');
      connectionTries += 1;
      if (connectionTries >= 50) {
        clearInterval(tryConnectionInterval);
      }
    }
  }, 10000);
};

const bootstrap = async () => {
  const logger = new Logger(bootstrap.name);

  const app = await NestFactory.create<NestExpressApplication>(ApplicationModule, { cors: true, logger });
  app.enable('trust proxy');
  app.useGlobalPipes(new ValidationPipe());
  app.useLogger(app.get(Logger));
  app.useGlobalGuards(new JwtAuthGuard(new Reflector()), new RolesGuard(new Reflector()));

  const PORT = app.get<ConfigService>(ConfigService).get<number>('server.port');

  const packageJsonPath = path.join(__dirname, '..', 'package.json');
  const packageJsonString = readFileSync(packageJsonPath, 'utf8');
  const packageJson = JSON.parse(packageJsonString) as { version: string };

  createIndexes(app);

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


  SwaggerModule.setup('api/v1/docs', app, document);

  await app.listen(PORT);
  logger.log({
    message: `server version ${packageJson.version} started!`,
    port: PORT,
    url: `http://localhost:${PORT}/api`,
  });
};

bootstrap().catch((reason) => Logger.error(reason));
