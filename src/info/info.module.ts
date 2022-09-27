import { Module } from '@nestjs/common';
import { ConfigModule } from '../shared/config/config.module';
import { NeverminedModule } from '../shared/nevermined/nvm.module';
import { InfoController } from './info.controller';

@Module({
  imports: [NeverminedModule, ConfigModule],
  providers: [],
  controllers: [InfoController],
  exports: [],
})
export class InfoModule {}
