import { Module } from '@nestjs/common';
import { NeverminedService } from './nvm.service';
import { ConfigModule } from '../config/config.module';

@Module({
  imports: [ConfigModule],
  providers: [NeverminedService],
  exports: [NeverminedService],
})
export class NeverminedModule {
}
