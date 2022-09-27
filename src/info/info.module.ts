import { Module } from '@nestjs/common';
import { NeverminedModule } from '../shared/nevermined/nvm.module';
import { InfoController } from './info.controller';

@Module({
  imports: [NeverminedModule],
  providers: [],
  controllers: [InfoController],
  exports: [],
})
export class InfoModule {}
