import {
  Controller,
  Get,
  All,
  Req,
  Res,
  UseGuards,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthGuard } from './modules/auth/guards/auth.guard';
import { ProxyService } from './modules/proxy/proxy.service';
import { Public } from './common/decorators/public.decorator';
import { UserPayload } from './modules/auth/auth.service';

@Controller()
export class AppController {
  constructor(private readonly proxyService: ProxyService) {}

  @Get('/health')
  @Public()
  health() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  @All('*')
  @UseGuards(AuthGuard)
  async proxyRequest(@Req() request: Request, @Res() response: Response) {
    // Guard 已经处理了服务匹配和认证，如果未匹配到服务会抛出 NotFoundException
    const user = (request as any).user as UserPayload | undefined;
    const proxyHandler = await this.proxyService.getProxyHandler(
      request.url,
      user,
    );

    if (!proxyHandler) {
      throw new HttpException('Service not found', HttpStatus.NOT_FOUND);
    }

    // 执行代理处理
    await proxyHandler(request, response);
  }
}
