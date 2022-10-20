import { Routes } from 'nest-router'
import { AuthModule } from './auth/auth.module'
import { EncryptModule } from './encrypt/encrypt.module'
import { InfoModule } from './info/info.module'
import { AccessModule } from './access/access.module'

export const routes: Routes = [
  { path: '/api/v1/gateway/services/encrypt', module: EncryptModule },
  { path: '/api/v1/gateway/services/oauth', module: AuthModule },
  { path: '/api/v1/gateway/services', module: AccessModule },
  { path: '/', module: InfoModule },
]
