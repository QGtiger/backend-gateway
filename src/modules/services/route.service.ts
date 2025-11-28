import { Injectable, Logger } from '@nestjs/common';
import { ALL_SERVICES, ServiceConfig } from '@/config/services';

@Injectable()
export class RouteService {
  private readonly logger = new Logger(RouteService.name);
  private services: ServiceConfig[] = [];

  constructor() {
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

  /**
   * 精确匹配路径前缀，确保匹配的是完整的路径段
   * 例如：/api/aireview 匹配 /api/aireview 和 /api/aireview/xxx
   * 但不匹配 /api/aire
   */
  matchesPathPrefix(url: string, prefix: string): boolean {
    if (!url.startsWith(prefix)) {
      return false;
    }

    // 如果完全匹配，返回 true
    if (url === prefix) {
      return true;
    }

    // 如果前缀后跟 /，说明是完整的路径段，返回 true
    // 例如：/api/aireview/xxx 匹配 /api/aireview
    if (url[prefix.length] === '/') {
      return true;
    }

    // 否则不匹配（例如：/api/aire 不匹配 /api/aireview）
    return false;
  }

  /**
   * 根据 URL 查找匹配的服务配置
   */
  findTargetService(url: string): ServiceConfig | null {
    for (const service of this.services) {
      if (this.matchesPathPrefix(url, service.path)) {
        return service;
      }
    }
    return null;
  }
}
