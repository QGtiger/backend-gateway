import { Injectable, HttpStatus, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { UserPayload } from '../auth/auth.service';
import { ServiceConfig } from '@/config/services';
import { RouteService } from '../services/route.service';

@Injectable()
export class ProxyService {
  private readonly logger = new Logger(ProxyService.name);
  private readonly axiosInstances: Map<string, AxiosInstance> = new Map();

  constructor(
    private readonly configService: ConfigService,
    private readonly routeService: RouteService,
  ) {}

  /**
   * 获取或创建 Axios 实例
   */
  private getAxiosInstance(service: ServiceConfig): AxiosInstance {
    const key = service.target;
    if (!this.axiosInstances.has(key)) {
      const instance = axios.create({
        baseURL: service.target,
        timeout: service.timeout || 30000,
        validateStatus: () => true, // 不抛出错误，让所有状态码都通过
      });
      this.axiosInstances.set(key, instance);
    }
    const instance = this.axiosInstances.get(key);
    if (!instance) {
      throw new Error(`Failed to create axios instance for ${key}`);
    }
    return instance;
  }

  /**
   * 重写路径
   */
  private rewritePath(path: string, service: ServiceConfig): string {
    if (!service.pathRewrite) {
      return path;
    }

    if (typeof service.pathRewrite === 'function') {
      return service.pathRewrite(path, null);
    }

    // 对象形式：正则表达式替换
    let rewrittenPath = path;
    for (const [pattern, replacement] of Object.entries(service.pathRewrite)) {
      const regex = new RegExp(pattern);
      rewrittenPath = rewrittenPath.replace(regex, replacement);
    }
    return rewrittenPath;
  }

  /**
   * 构建目标 URL
   */
  private buildTargetUrl(req: Request, service: ServiceConfig): string {
    const originalPath = req.url.split('?')[0]; // 移除查询参数
    const rewrittenPath = this.rewritePath(originalPath, service);
    const queryString = req.url.includes('?')
      ? req.url.substring(req.url.indexOf('?'))
      : '';
    return rewrittenPath + queryString;
  }

  /**
   * 构建请求头
   */
  private buildHeaders(
    req: Request,
    service: ServiceConfig,
    user?: UserPayload,
  ): Record<string, string> {
    const headers: Record<string, string> = {};

    // 复制原始请求头（排除一些不需要的）
    const excludeHeaders = new Set([
      'host',
      'content-length',
      'connection',
      'transfer-encoding',
    ]);
    Object.keys(req.headers).forEach((key) => {
      const lowerKey = key.toLowerCase();
      if (!excludeHeaders.has(lowerKey) && !lowerKey.startsWith('x-user-')) {
        const value = req.headers[key];
        if (typeof value === 'string') {
          headers[key] = value;
        } else if (Array.isArray(value) && value.length > 0) {
          headers[key] = value.join(', ');
        }
      }
    });

    // 添加用户信息到请求头
    if (user) {
      headers['x-user-id'] = user.userId;
      headers['x-username'] = user.username;
    }

    return headers;
  }

  /**
   * 获取请求体
   */
  private async getRequestBody(req: Request): Promise<any> {
    // 如果已经有 body（Express 的 body-parser 已处理），直接返回
    if (req.body && Object.keys(req.body).length > 0) {
      return req.body;
    }

    // 如果没有 body，尝试从原始请求中读取
    if (req.readable && req.readableLength > 0) {
      return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        req.on('data', (chunk) => chunks.push(chunk));
        req.on('end', () => {
          const body = Buffer.concat(chunks);
          const contentType = req.headers['content-type'] || '';

          if (contentType.includes('application/json')) {
            try {
              resolve(JSON.parse(body.toString()));
            } catch {
              resolve(body);
            }
          } else if (
            contentType.includes('application/x-www-form-urlencoded')
          ) {
            resolve(body.toString());
          } else {
            resolve(body);
          }
        });
        req.on('error', reject);
      });
    }

    return undefined;
  }

  /**
   * 代理请求
   */
  async proxyRequest(
    req: Request,
    res: Response,
    service: ServiceConfig,
    user?: UserPayload,
  ): Promise<void> {
    try {
      const targetUrl = this.buildTargetUrl(req, service);
      const headers = this.buildHeaders(req, service, user);
      const axiosInstance = this.getAxiosInstance(service);

      this.logger.debug(
        `代理请求: ${req.method} ${req.url} -> ${service.target}${targetUrl}`,
      );
      this.logger.debug(`请求头: ${JSON.stringify(headers)}`);

      // 获取请求体
      const body = await this.getRequestBody(req);
      if (body !== undefined) {
        this.logger.debug(`请求体: ${JSON.stringify(body)}`);
      }

      // 构建 axios 请求配置
      const axiosConfig: AxiosRequestConfig = {
        method: req.method as any,
        url: targetUrl,
        headers,
        params: req.query,
        data: body,
        responseType: 'arraybuffer', // 使用 arraybuffer 以支持所有类型的响应
        maxRedirects: 5,
      };

      // 发送请求
      const response = await axiosInstance.request(axiosConfig);

      this.logger.debug(`代理响应: ${response.status} ${response.statusText}`);

      // 设置响应头
      Object.keys(response.headers).forEach((key) => {
        const lowerKey = key.toLowerCase();
        // 排除一些不应该转发的响应头
        if (
          ![
            'content-encoding',
            'content-length',
            'transfer-encoding',
            'connection',
          ].includes(lowerKey)
        ) {
          const value = response.headers[key];
          if (typeof value === 'string') {
            res.setHeader(key, value);
          } else if (Array.isArray(value)) {
            res.setHeader(key, value.join(', '));
          }
        }
      });

      // 设置状态码并发送响应
      res.status(response.status);
      res.send(response.data);
    } catch (error: any) {
      this.logger.error(`代理错误: ${error.message}`, error.stack);

      if (!res.headersSent) {
        // HTTP 状态码统一为 200，实际状态码通过响应体中的 code 字段表示
        res.status(HttpStatus.OK).json({
          success: false,
          code: error.response?.status || HttpStatus.BAD_GATEWAY,
          message: error.response?.statusText || 'Service unavailable',
          error: error.message,
        });
      }
    }
  }

  /**
   * 获取代理处理器
   */
  async getProxyHandler(
    url: string,
    user?: UserPayload,
  ): Promise<((req: Request, res: Response) => Promise<void>) | null> {
    const service = this.routeService.findTargetService(url);
    if (!service) {
      return null;
    }

    return (req: Request, res: Response) =>
      this.proxyRequest(req, res, service, user);
  }
}
