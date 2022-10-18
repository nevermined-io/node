import { Module } from '@nestjs/common';
import { NeverminedModule } from '../shared/nevermined/nvm.module';
import { ComputeController } from './compute.controller';
import { ComputeService } from './compute.service';

@Module({
  providers: [ComputeService],
  imports: [NeverminedModule],
  controllers: [ComputeController],
  exports: [],
})
export class ComputeModule {}
