import {
  Controller,
  Get,
  All,
  Req,
  Res,
  UseGuards,
  HttpException,
  HttpStatus,
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
    const user = (request as any).user as UserPayload | undefined;
    const proxyMiddleware = this.proxyService.getProxyMiddleware(
      request.url,
      user,
    );

    if (!proxyMiddleware) {
      throw new HttpException('Service not found', HttpStatus.NOT_FOUND);
    }

    // 执行代理中间件
    proxyMiddleware(request, response, () => {
      // 如果中间件没有处理请求，返回404
      if (!response.headersSent) {
        response.status(HttpStatus.NOT_FOUND).json({
          statusCode: HttpStatus.NOT_FOUND,
          message: 'Route not found',
        });
      }
    });
  }
}
