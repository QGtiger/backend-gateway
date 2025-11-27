import { Injectable, HttpStatus, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createProxyMiddleware, Options } from 'http-proxy-middleware';
import { Request, Response } from 'express';
import { UserPayload } from '../auth/auth.service';
import { ALL_SERVICES, ServiceConfig } from '@/config/services';

@Injectable()
export class ProxyService {
  private readonly logger = new Logger(ProxyService.name);
  private services: ServiceConfig[] = [];

  constructor(private configService: ConfigService) {
    this.loadServicesConfig();
  }

  private loadServicesConfig(): void {
    // 按路径长度降序排序，优先匹配更具体的路径
    this.services = [...ALL_SERVICES].sort(
      (a, b) => b.path.length - a.path.length,
    );

    this.logger.log(
      `已加载 ${this.services.length} 个服务配置 ${JSON.stringify(
        this.services,
      )}`,
    );
  }

  findTargetService(url: string): ServiceConfig | null {
    for (const service of this.services) {
      if (url.startsWith(service.path)) {
        return service;
      }
    }
    return null;
  }

  createProxyMiddleware(
    service: ServiceConfig,
    user?: UserPayload,
  ): (req: Request, res: Response, next: () => void) => void {
    const proxyOptions: Options = {
      target: service.target,
      changeOrigin: service.changeOrigin ?? true,
      pathRewrite: service.pathRewrite || {},
      timeout: service.timeout || 30000,
      onProxyReq: (proxyReq, req: Request) => {
        // 移除敏感头信息
        proxyReq.removeHeader('host');
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
    const service = this.findTargetService(url);
    if (!service) {
      return null;
    }

    return this.createProxyMiddleware(service, user);
  }
}
