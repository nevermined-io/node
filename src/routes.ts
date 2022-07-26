import { Routes } from 'nest-router';
import { AuthModule } from './auth/auth.module';
import { EncryptModule } from './encrypt/encrypt.module';
import { PermissionModule } from './permissions/permission.module';
import { InfoModule } from './info/info.module';

export const routes: Routes = [
  { path: '/api/v1/gateway/services/encrypt', module: EncryptModule },
  { path: '/api/v1/auth', module: AuthModule },
  { path: '/api/v1/permissions', module: PermissionModule },
  { path: '/', module: InfoModule },
];
