基于 NestJS 开发 API 网关是一个很好的架构选择。我来为你提供完整的架构设计和实现思路。

## 🏗️ 整体架构图

### 系统架构概览

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   客户端         │    │   API 网关       │    │   业务服务       │
│ (Web/App/前端)  │───▶│  (NestJS)       │───▶│  (NestJS/其他)  │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         │ 1. 请求携带Token       │ 3. 转发请求(带用户信息) │ 4. 处理业务逻辑
         │ ────────────────────▶ │ ────────────────────▶ │
         │                       │                       │
         │ 6. 返回业务数据        │ 5. 返回业务数据        │
         │ ◀──────────────────── │ ◀──────────────────── │
         │                       │                       │
         │                       │ 2. Token校验          │
         │                       │    & 用户信息提取      │
         │                       │    (JWT/Redis)        │
         │                       │                       │
```

## 🔧 API 网关内部架构

```
┌─────────────────────────────────────────────────────────┐
│                    API Gateway (NestJS)                 │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │  认证模块    │  │  路由模块    │  │   代理模块       │  │
│  │ AuthModule  │  │ RouteModule │  │  ProxyModule    │  │
│  └─────────────┘  └─────────────┘  └─────────────────┘  │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │  守卫层      │  │  中间件层    │  │   服务层        │  │
│  │ AuthGuard   │  │ Middleware  │  │  ProxyService   │  │
│  │ RateGuard   │  │ Logging     │  │  ConfigService  │  │
│  └─────────────┘  └─────────────┘  └─────────────────┘  │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐ │
│  │                    HTTP Adapter                     │ │
│  └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

## 📦 核心模块设计

### 1. 网关项目结构

```bash
api-gateway/
├── src/
│   ├── main.ts
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── auth.module.ts
│   │   │   ├── guards/
│   │   │   │   ├── auth.guard.ts
│   │   │   │   └── rate-limit.guard.ts
│   │   │   └── strategies/
│   │   │       └── jwt.strategy.ts
│   │   ├── proxy/
│   │   │   ├── proxy.module.ts
│   │   │   ├── proxy.service.ts
│   │   │   └── interfaces/
│   │   │       └── service-config.interface.ts
│   │   └── health/
│   │       └── health.module.ts
│   ├── middleware/
│   │   ├── logging.middleware.ts
│   │   └── cors.middleware.ts
│   └── common/
│       ├── filters/
│       │   └── http-exception.filter.ts
│       └── interceptors/
│           └── transform.interceptor.ts
├── config/
│   └── services.yaml
└── package.json
```

### 2. 核心代码实现

#### 认证守卫 (Auth Guard)

```typescript
// auth.guard.ts
import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);
    
    if (!token) {
      throw new UnauthorizedException('Token not found');
    }

    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_SECRET,
      });
      // 将用户信息添加到请求中，供后续使用
      request['user'] = payload;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }

    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers['authorization']?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
```

#### 代理服务 (Proxy Service)

```typescript
// proxy.service.ts
import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { Request } from 'express';
import { firstValueFrom } from 'rxjs';
import { ServiceConfig } from './interfaces/service-config.interface';

@Injectable()
export class ProxyService {
  private services: Map<string, ServiceConfig> = new Map();

  constructor(private httpService: HttpService) {
    this.initializeServices();
  }

  private initializeServices() {
    // 从配置文件或环境变量加载服务配置
    this.services.set('user-service', {
      baseUrl: process.env.USER_SERVICE_URL || 'http://localhost:3001',
      prefix: '/api/users',
      requiresAuth: true,
    });
    this.services.set('order-service', {
      baseUrl: process.env.ORDER_SERVICE_URL || 'http://localhost:3002',
      prefix: '/api/orders',
      requiresAuth: true,
    });
    this.services.set('product-service', {
      baseUrl: process.env.PRODUCT_SERVICE_URL || 'http://localhost:3003',
      prefix: '/api/products',
      requiresAuth: false,
    });
  }

  async forwardRequest(request: Request, user: any) {
    const { originalUrl, method, body, headers } = request;
    
    // 根据URL路径确定目标服务
    const targetService = this.findTargetService(originalUrl);
    if (!targetService) {
      throw new HttpException('Service not found', HttpStatus.NOT_FOUND);
    }

    // 构建目标URL
    const targetUrl = this.buildTargetUrl(originalUrl, targetService);
    
    // 准备转发头信息
    const forwardHeaders = this.prepareForwardHeaders(headers, user);

    try {
      // 转发请求
      const response = await firstValueFrom(
        this.httpService.request({
          url: targetUrl,
          method: method as any,
          data: body,
          headers: forwardHeaders,
          timeout: 10000, // 10秒超时
        })
      );

      return response.data;
    } catch (error) {
      this.handleProxyError(error);
    }
  }

  private findTargetService(url: string): ServiceConfig | null {
    for (const service of this.services.values()) {
      if (url.startsWith(service.prefix)) {
        return service;
      }
    }
    return null;
  }

  private buildTargetUrl(originalUrl: string, service: ServiceConfig): string {
    const pathWithoutPrefix = originalUrl.replace(service.prefix, '');
    return `${service.baseUrl}${pathWithoutPrefix}`;
  }

  private prepareForwardHeaders(originalHeaders: any, user: any): any {
    const headers = { ...originalHeaders };
    
    // 移除敏感头信息
    delete headers.host;
    delete headers['content-length'];
    
    // 添加用户信息头（业务服务可以信任这些头信息）
    if (user) {
      headers['x-user-id'] = user.userId;
      headers['x-user-role'] = user.role;
    }

    return headers;
  }

  private handleProxyError(error: any): never {
    if (error.response) {
      // 业务服务返回的错误
      throw new HttpException(error.response.data, error.response.status);
    } else if (error.request) {
      // 网络错误或服务不可用
      throw new HttpException('Service unavailable', HttpStatus.SERVICE_UNAVAILABLE);
    } else {
      // 其他错误
      throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
```

#### 全局控制器 (Global Controller)

```typescript
// app.controller.ts
import { Controller, All, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthGuard } from './auth/guards/auth.guard';
import { ProxyService } from './proxy/proxy.service';

@Controller()
export class AppController {
  constructor(private readonly proxyService: ProxyService) {}

  @All('*')
  @UseGuards(AuthGuard)
  async proxyRequest(@Req() request: Request, @Res() response: Response) {
    try {
      const user = request['user']; // 从守卫中获取的用户信息
      const result = await this.proxyService.forwardRequest(request, user);
      
      return response.json(result);
    } catch (error) {
      // 错误处理中间件会捕获这个错误
      throw error;
    }
  }
}
```

#### 路由级认证控制

```typescript
// 如果你需要对某些路由进行特殊认证控制，可以这样设计
import { applyDecorators, UseGuards, SetMetadata } from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard';

// 自定义装饰器，用于标记不需要认证的路由
export const Public = () => SetMetadata('isPublic', true);

// 在控制器中使用
@Controller()
export class AppController {
  constructor(private readonly proxyService: ProxyService) {}

  @Public()
  @Get('/api/products/*')
  async publicRoute(@Req() request: Request, @Res() response: Response) {
    // 公开路由，不需要认证
    const result = await this.proxyService.forwardRequest(request, null);
    return response.json(result);
  }

  @All('*')
  @UseGuards(AuthGuard)
  async protectedRoute(@Req() request: Request, @Res() response: Response) {
    // 需要认证的路由
    const user = request['user'];
    const result = await this.proxyService.forwardRequest(request, user);
    return response.json(result);
  }
}
```

## 🔄 请求流转流程

### 1. 请求进入网关
```
客户端请求 → 网关入口 → 中间件链(日志、CORS等) → 路由匹配
```

### 2. 认证流程
```
路由匹配 → 认证守卫 → JWT解析 → 用户信息提取 → 注入请求对象
```

### 3. 请求转发
```
认证通过 → 代理服务 → 服务发现 → 请求转发 → 业务服务处理
```

### 4. 响应返回
```
业务服务响应 → 代理服务 → 响应转换 → 返回客户端
```

## ⚙️ 配置文件示例

### 服务配置 (config/services.yaml)
```yaml
services:
  user-service:
    baseUrl: http://localhost:3001
    prefix: /api/users
    requiresAuth: true
    timeout: 10000
    
  order-service:
    baseUrl: http://localhost:3002
    prefix: /api/orders  
    requiresAuth: true
    timeout: 15000
    
  product-service:
    baseUrl: http://localhost:3003
    prefix: /api/products
    requiresAuth: false
    timeout: 8000
```

## 🚀 部署架构建议

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   负载均衡器     │    │   API 网关集群    │    │   业务服务集群   │
│   (Nginx)      │───▶│   (Docker/K8s)  │───▶│   (多个服务)    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │              ┌────────┴────────┐
         │                       │        ┌─────▼─────┐    ┌─────▼─────┐
         │                       │        │用户服务    │    │订单服务    │
         │                       │        └───────────┘    └───────────┘
         │                       │
┌────────▼───────────────────────▼────────┐
│            共享服务                      │
│    ┌─────────┐    ┌─────────┐          │
│    │ Redis   │    │ 数据库   │          │
│    │ (会话)  │    │(用户信息)│          │
│    └─────────┘    └─────────┘          │
└────────────────────────────────────────┘
```

## 💡 扩展功能建议

1. **限流防护** - 集成 `@nestjs/throttler` 防止API滥用
2. **缓存层** - 对频繁请求的数据添加Redis缓存
3. **服务发现** - 集成Consul或Eureka实现动态服务发现
4. **链路追踪** - 添加Request ID实现全链路追踪
5. **监控告警** - 集成Prometheus监控网关性能
6. **配置中心** - 使用Nacos或Apollo动态管理配置

这样的网关架构可以提供统一的认证入口、请求路由、负载均衡和防护能力，让你的微服务架构更加健壮和安全。