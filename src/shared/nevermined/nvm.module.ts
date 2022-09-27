import { Module } from '@nestjs/common';
import { NeverminedService } from './nvm.service';
import { ConfigModule } from '../config/config.module';
import { LoggerModule } from '../logger/logger.module';

@Module({
  imports: [ConfigModule, LoggerModule],
  providers: [NeverminedService],
  exports: [NeverminedService],
})
export class NeverminedModule {
}
