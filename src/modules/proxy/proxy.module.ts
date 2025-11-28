import { Module } from '@nestjs/common';
import { ProxyService } from './proxy.service';
import { ServicesModule } from '../services/services.module';

@Module({
  imports: [ServicesModule],
  providers: [ProxyService],
  exports: [ProxyService],
})
export class ProxyModule {}
