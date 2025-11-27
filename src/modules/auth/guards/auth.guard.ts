import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';
import { IS_PUBLIC_KEY } from '../../../common/decorators/public.decorator';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private authService: AuthService,
    private reflector: Reflector,
    private configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 检查是否是公开路由（通过装饰器）
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const requestUrl = request.url.split('?')[0]; // 移除查询参数

    // 检查配置的公开前缀列表（优先级最高，支持路径前缀匹配）
    const publicPrefixes = this.configService
      .get<string>('PUBLIC_PREFIXES', '')
      .split(',')
      .map((prefix) => prefix.trim())
      .filter((prefix) => prefix.length > 0);

    if (publicPrefixes.some((prefix) => requestUrl.startsWith(prefix))) {
      return true;
    }

    // 提取Token
    const token = this.authService.extractTokenFromHeader(
      request.headers.authorization,
    );

    if (!token) {
      throw new UnauthorizedException('Token not found');
    }

    try {
      // 验证Token并提取用户信息
      const user = await this.authService.validateToken(token);
      // 将用户信息注入到请求对象
      request.user = user;
      return true;
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }
}
