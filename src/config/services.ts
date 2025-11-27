export interface ServiceConfig {
  path: string;
  target: string;
  requiresAuth?: boolean;
  timeout?: number;
  changeOrigin?: boolean;
  pathRewrite?: {
    [key: string]: string;
  };
}

export const ALL_SERVICES: ServiceConfig[] = [
  {
    path: '/api/account',
    target: 'http://localhost:3001',
    requiresAuth: true,
    timeout: 10000,
    changeOrigin: true,
  },
  // {
  //   path: '/api/orders',
  //   target: 'http://localhost:3002',
  //   requiresAuth: true,
  //   timeout: 15000,
  //   changeOrigin: true,
  // },
  // {
  //   path: '/api/products',
  //   target: 'http://localhost:3003',
  //   requiresAuth: false,
  //   timeout: 8000,
  //   changeOrigin: true,
  // },
];
