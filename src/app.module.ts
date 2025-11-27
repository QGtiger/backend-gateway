import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AuthModule } from './modules/auth/auth.module';
import { ProxyModule } from './modules/proxy/proxy.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    AuthModule,
    ProxyModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
