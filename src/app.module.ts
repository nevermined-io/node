import { Module, MiddlewareConsumer, RequestMethod } from '@nestjs/common'
import { RouterModule } from 'nest-router'
import { routes } from './routes'
import { ConfigModule } from './shared/config/config.module'
import { LoggerModule } from './shared/logger/logger.module'
import { InfoModule } from './info/info.module'
import { HttpsRedirectMiddleware } from './common/middlewares/https-redirection/https-redirection.middleware'
import { AuthModule } from './auth/auth.module'
import { EncryptModule } from './encrypt/encrypt.module'
import { AccessModule } from './access/access.module'
import { NeverminedModule } from './shared/nevermined/nvm.module'
import { ComputeModule } from './compute/compute.module'
import { HttpLoggerMiddleware } from './common/middlewares/http-logger/http-logger.middleware'

@Module({
  imports: [
    RouterModule.forRoutes(routes),
    LoggerModule,
    ConfigModule,
    InfoModule,
    EncryptModule,
    AccessModule,
    AuthModule,
    NeverminedModule,
    ComputeModule,
  ],
})
export class ApplicationModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(HttpsRedirectMiddleware).forRoutes({ path: '*', method: RequestMethod.ALL })
    consumer.apply(HttpLoggerMiddleware).forRoutes('*')
  }
}
