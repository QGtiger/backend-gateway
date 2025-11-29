# 第一阶段：构建阶段
FROM node:24-alpine AS builder

# 安装 pnpm
RUN npm install -g pnpm

# 设置工作目录
WORKDIR /app

# 复制包管理文件
COPY package.json pnpm-lock.yaml ./

# 安装依赖
RUN pnpm config set registry https://registry.npmmirror.com && pnpm install --frozen-lockfile

# 复制源代码
COPY . .

# 构建应用
RUN pnpm build

# 第二阶段：生产阶段
FROM node:24-alpine AS production

# 安装 pnpm
RUN npm install -g pnpm

# 设置工作目录
WORKDIR /app

# 复制包管理文件
COPY package.json pnpm-lock.yaml ./

# 只安装生产依赖
RUN pnpm config set registry https://registry.npmmirror.com && pnpm install --prod --frozen-lockfile

# 从构建阶段复制构建产物
COPY --from=builder /app/dist ./dist

# 创建非 root 用户
RUN addgroup -g 1001 -S nodejs && \
  adduser -S nestjs -u 1001

# 更改文件所有者
RUN chown -R nestjs:nodejs /app
USER nestjs

# 暴露端口
EXPOSE 9999

# 启动应用
CMD ["node", "dist/main.js"]

