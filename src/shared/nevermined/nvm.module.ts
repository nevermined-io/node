import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { NeverminedService } from './nvm.service';
import { ConfigModule } from '../config/config.module';

@Module({
  imports: [ConfigModule, HttpModule],
  providers: [NeverminedService],
  exports: [NeverminedService],
})
export class NeverminedModule {}
