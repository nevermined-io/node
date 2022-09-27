import { Module } from '@nestjs/common';
import { InfoController } from './info.controller';

@Module({
  imports: [],
  providers: [],
  controllers: [InfoController],
  exports: [],
})
export class InfoModule {}
