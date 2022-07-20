import { Module } from '@nestjs/common';
import { AccessController } from './access.controller';

@Module({
  providers: [],
  controllers: [AccessController],
  exports: [],
})
export class AccessModule {}
