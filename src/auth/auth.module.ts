import { Module } from '@nestjs/common'
import { PassportModule } from '@nestjs/passport'
import { AuthService } from './auth.service'
import { AuthController } from './auth.controller'
import { JwtModule } from '@nestjs/jwt'
import { JwtStrategy } from '../common/strategies/jwt.strategy'
import { ConfigModule } from '../shared/config/config.module'
import { ConfigService } from '../shared/config/config.service'
import { NeverminedModule } from '../shared/nevermined/nvm.module'
import { NeverminedStrategy } from './nvm.strategy'
import { BackendModule } from '../shared/backend/backend.module'

@Module({
  imports: [
    ConfigModule,
    BackendModule,
    NeverminedModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        return {
          secret: config.get('JWT_SECRET_KEY'),
          signOptions: { expiresIn: config.get('JWT_EXPIRY_KEY') },
        }
      },
    }),
  ],
  providers: [AuthService, JwtStrategy, ConfigService, NeverminedStrategy],
  controllers: [AuthController],
})
export class AuthModule {}
