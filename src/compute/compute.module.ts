import { Module } from '@nestjs/common';
import { NeverminedModule } from '../shared/nevermined/nvm.module';
import { ComputeController } from './compute.controller';

@Module({
  providers: [],
  imports: [NeverminedModule],
  controllers: [ComputeController],
  exports: [],
})
export class ComputeModule {}
