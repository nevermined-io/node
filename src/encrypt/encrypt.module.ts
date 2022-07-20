import { Module } from '@nestjs/common';
import { EncryptController } from './encrypt.controller';
import { ElasticModule } from '../shared/elasticsearch/elastic.module';

@Module({
  imports: [ElasticModule],
  providers: [],
  controllers: [EncryptController],
  exports: [],
})
export class EncryptModule {}
