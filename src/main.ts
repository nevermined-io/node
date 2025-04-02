import { Logger, ValidationPipe } from '@nestjs/common'
import { NestFactory, Reflector } from '@nestjs/core'
import { NestExpressApplication } from '@nestjs/platform-express'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { readFileSync } from 'fs'
import path from 'path'
import { ApplicationModule } from './app.module'
import { JwtAuthGuard } from './common/guards/auth/jwt-auth.guard'
import { RolesGuard } from './common/guards/auth/roles.guards'
import { ConfigService } from './shared/config/config.service'
import morgan from 'morgan'

const bootstrap = async () => {
  console.log(process.env.NODE_ENV)
  const app = await NestFactory.create<NestExpressApplication>(ApplicationModule, {
    cors: true,
    logger: ['error', 'log', 'warn'],
  })

  // http middleware logger
  app.use(
    morgan('dev', {
      stream: {
        write: (message: string) => {
          Logger.log(message.trim())
        },
      },
    }),
  )

  app.enable('trust proxy')
  app.useGlobalPipes(new ValidationPipe())
  app.useGlobalGuards(new JwtAuthGuard(new Reflector()), new RolesGuard(new Reflector()))

  const PORT = app.get<ConfigService>(ConfigService).get<number>('server.port')

  const packageJsonPath = path.join(__dirname, '..', 'package.json')
  const packageJsonString = readFileSync(packageJsonPath, 'utf8')
  const packageJson = JSON.parse(packageJsonString) as { version: string }

  const options = new DocumentBuilder()
    .setTitle('Nevermined Node')
    .setVersion(packageJson.version)
    .addBearerAuth(
      {
        type: 'http',
      },
      'Authorization',
    )
    .build()
  const document = SwaggerModule.createDocument(app, options)

  SwaggerModule.setup('api/v1/docs', app, document)

  await app.listen(PORT || 8030)
  Logger.log({
    message: `server version ${packageJson.version} started!`,
    port: PORT,
    url: `http://localhost:${PORT}/api`,
  })
}

bootstrap().catch((reason) => Logger.error(reason))
