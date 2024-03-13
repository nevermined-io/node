import { MiddlewareConsumer, Module, RequestMethod } from '@nestjs/common'
import { RouterModule } from '@nestjs/core'
import { AccessModule } from './access/access.module'
import { AuthModule } from './auth/auth.module'
import { HttpsRedirectMiddleware } from './common/middlewares/https-redirection/https-redirection.middleware'
import { ComputeModule } from './compute/compute.module'
import { EncryptModule } from './encrypt/encrypt.module'
import { InfoModule } from './info/info.module'
import { routes } from './routes'
import { BackendModule } from './shared/backend/backend.module'
import { ConfigModule } from './shared/config/config.module'
import { NeverminedModule } from './shared/nevermined/nvm.module'
import { SubscriptionsModule } from './subscriptions/subscriptions.module'

@Module({
  imports: [
    RouterModule.register(routes),
    ConfigModule,
    InfoModule,
    EncryptModule,
    AccessModule,
    AuthModule,
    NeverminedModule,
    ComputeModule,
    SubscriptionsModule,
    BackendModule,
  ],
})
export class ApplicationModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(HttpsRedirectMiddleware).forRoutes({ path: '*', method: RequestMethod.ALL })
  }
}
