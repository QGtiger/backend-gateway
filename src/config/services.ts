/**
 * 路径重写规则类型
 *
 * 支持两种形式：
 * 1. 对象形式：使用正则表达式匹配路径并替换
 *    - key: 正则表达式字符串（如 '^/api/old'）
 *    - value: 替换后的路径（如 '/api/new' 或 '' 表示移除）
 *
 * 2. 函数形式：自定义路径重写逻辑
 *    - 参数: (path: string, req: Request) => string
 *    - 返回: 重写后的路径
 *
 * @example
 * // 对象形式 - 移除路径前缀
 * pathRewrite: {
 *   '^/api/aireview': ''  // /api/aireview/webhook -> /webhook
 * }
 *
 * @example
 * // 对象形式 - 替换路径前缀
 * pathRewrite: {
 *   '^/api/v1': '/api/v2'  // /api/v1/users -> /api/v2/users
 * }
 *
 * @example
 * // 对象形式 - 多个规则
 * pathRewrite: {
 *   '^/api/old': '/api/new',
 *   '^/remove': ''
 * }
 *
 * @example
 * // 函数形式 - 自定义逻辑
 * pathRewrite: (path, req) => {
 *   if (path.startsWith('/api/aireview')) {
 *     return path.replace('/api/aireview', '');
 *   }
 *   return path;
 * }
 */
export type PathRewrite =
  | {
      /**
       * 路径重写规则对象
       * key 为正则表达式字符串，value 为替换后的路径
       *
       * 注意：key 中的特殊字符会被自动转义，但建议使用正则表达式语法
       * 例如：'^/api/aireview' 匹配以 /api/aireview 开头的路径
       */
      [pattern: string]: string;
    }
  | ((path: string, req: any) => string);

/**
 * 服务配置接口
 */
export interface ServiceConfig {
  /** 服务路径前缀，用于匹配请求路径 */
  path: string;

  /** 目标服务地址 */
  target: string;

  /** 是否需要认证，默认为 false */
  requiresAuth?: boolean;

  /** 请求超时时间（毫秒），默认 30000 */
  timeout?: number;

  /** 是否改变请求头中的 origin，默认 true */
  changeOrigin?: boolean;

  /**
   * 路径重写规则（可选）
   *
   * 如果未配置 pathRewrite，路径会原样传递给目标服务
   * 例如：path 为 '/api/aireview'，请求 '/api/aireview/webhook/github'
   *      会原样传递为 '/api/aireview/webhook/github'
   *
   * 如果需要移除或修改路径，需要显式配置 pathRewrite
   * 例如：移除前缀 '/api/aireview/webhook/github' -> '/webhook/github'
   *      pathRewrite: { '^/api/aireview': '' }
   *
   * @see PathRewrite 类型定义查看详细用法
   */
  pathRewrite?: PathRewrite;
}

export const ALL_SERVICES: ServiceConfig[] = [
  {
    path: '/api/aireview',
    target: 'http://backend-aireview:3000',
    requiresAuth: false,
    timeout: 10000,
    changeOrigin: true,
    // 移除 /api/aireview 前缀
    // 例如：/api/aireview/webhook/github -> /webhook/github
    pathRewrite: {
      '^/api/aireview': '',
    },
  },
  {
    path: '/api/account',
    target: 'http://account-backend-container:7001',
    requiresAuth: false,
    timeout: 30000,
    changeOrigin: true,
    pathRewrite: {
      '^/api/account': '',
    },
  },
];
