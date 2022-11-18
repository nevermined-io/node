import { Routes } from 'nest-router';
import { AuthModule } from './auth/auth.module';
import { EncryptModule } from './encrypt/encrypt.module';
import { InfoModule } from './info/info.module';
import { AccessModule } from './access/access.module';
import { ComputeModule } from './compute/compute.module'

const exposeCompute: boolean = Boolean(process.env.ENABLE_COMPUTE) === true || false

export const routes: Routes = [
  { path: '/api/v1/node/services/encrypt', module: EncryptModule },
  { path: '/api/v1/node/services/oauth', module: AuthModule },
  { path: '/api/v1/node/services', module: AccessModule },
  { path: '/', module: InfoModule },
];

if (exposeCompute) routes.push({ path: '/api/v1/node/compute', module: ComputeModule })