import { Injectable, HttpStatus, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createProxyMiddleware, Options } from 'http-proxy-middleware';
import { Request, Response } from 'express';
import { UserPayload } from '../auth/auth.service';
import { ServiceConfig } from '@/config/services';
import { RouteService } from '../services/route.service';

@Injectable()
export class ProxyService {
  private readonly logger = new Logger(ProxyService.name);

  constructor(
    private configService: ConfigService,
    private routeService: RouteService,
  ) {}

  createProxyMiddleware(
    service: ServiceConfig,
    user?: UserPayload,
  ): (req: Request, res: Response, next: () => void) => void {
    const proxyOptions: Options = {
      target: service.target,
      changeOrigin: service.changeOrigin ?? true,
      pathRewrite: service.pathRewrite,
      timeout: service.timeout || 30000,
      onProxyReq: (proxyReq, req: Request) => {
        this.logger.debug(
          `代理请求: ${req.method} ${req.url} -> ${service.target}${
            proxyReq.path || req.url
          }`,
        );
        this.logger.debug(`请求头: ${JSON.stringify(proxyReq.getHeaders())}`);

        // 移除敏感头信息
        // proxyReq.removeHeader('host');
        proxyReq.removeHeader('content-length');

        // 添加用户信息到请求头
        if (user) {
          proxyReq.setHeader('x-user-id', user.userId);
          proxyReq.setHeader('x-username', user.username);
        }

        // 保留原始请求头（除了已移除的）
        const headers = req.headers;
        Object.keys(headers).forEach((key) => {
          if (
            key !== 'host' &&
            key !== 'content-length' &&
            !key.startsWith('x-user-')
          ) {
            const value = headers[key];
            if (typeof value === 'string') {
              proxyReq.setHeader(key, value);
            } else if (Array.isArray(value)) {
              proxyReq.setHeader(key, value.join(', '));
            }
          }
        });
      },
      onError: (err, req, res) => {
        this.logger.error(`代理错误: ${err.message}`, err.stack);
        if (!res.headersSent) {
          // HTTP 状态码统一为 200，实际状态码通过响应体中的 code 字段表示
          res.status(HttpStatus.OK).json({
            success: false,
            code: HttpStatus.BAD_GATEWAY,
            message: 'Service unavailable',
          });
        }
      },
      onProxyRes: (proxyRes) => {
        // 可以在这里处理响应
        this.logger.debug(
          `代理响应: ${proxyRes.statusCode} ${proxyRes.statusMessage}`,
        );
      },
    };

    return createProxyMiddleware(proxyOptions) as (
      req: Request,
      res: Response,
      next: () => void,
    ) => void;
  }

  getProxyMiddleware(
    url: string,
    user?: UserPayload,
  ): ((req: Request, res: Response, next: () => void) => void) | null {
    const service = this.routeService.findTargetService(url);
    if (!service) {
      return null;
    }

    return this.createProxyMiddleware(service, user);
  }
}
