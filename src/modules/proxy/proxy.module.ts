import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ProxyService } from './proxy.service';
import { ServicesModule } from '../services/services.module';

@Module({
  imports: [HttpModule, ServicesModule],
  providers: [ProxyService],
  exports: [ProxyService],
})
export class ProxyModule {}
