import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3000);

  // 注册全局异常过滤器
  app.useGlobalFilters(new HttpExceptionFilter());

  await app.listen(port);
  console.log(`应用正在运行在端口: ${port}`);
}
bootstrap();
