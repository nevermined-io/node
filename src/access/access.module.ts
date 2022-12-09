import { Module } from '@nestjs/common';
import { NeverminedModule } from '../shared/nevermined/nvm.module';
import { AccessController } from './access.controller';

@Module({
  providers: [],
  imports: [NeverminedModule],
  controllers: [AccessController],
  exports: [],
})
export class AccessModule {}
