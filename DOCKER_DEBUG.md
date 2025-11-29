# Docker 排查指南

## 1. 进入运行中的容器检查文件系统

```bash
# 进入容器
docker exec -it backend-gateway sh

# 检查 package.json 是否包含 @nestjs/axios
cat /app/package.json | grep "@nestjs/axios"

# 检查 node_modules 是否存在
ls -la /app/node_modules | grep "@nestjs"

# 检查 @nestjs/axios 是否安装
ls -la /app/node_modules/@nestjs/axios

# 检查 pnpm-lock.yaml
cat /app/pnpm-lock.yaml | grep "@nestjs/axios"

# 检查构建产物
ls -la /app/dist/modules/proxy/
```

## 2. 检查构建过程中的依赖安装

```bash
# 重新构建并查看详细输出
docker compose build --no-cache --progress=plain backend-gateway

# 或者分步构建查看
docker build --no-cache --target production -t backend-gateway:debug .
```

## 3. 验证本地文件

```bash
# 检查本地 package.json
cat package.json | grep "@nestjs/axios"

# 检查本地 pnpm-lock.yaml
cat pnpm-lock.yaml | grep "@nestjs/axios"

# 确保本地已安装
pnpm list @nestjs/axios
```

## 4. 临时调试方案

如果容器正在运行，可以临时进入容器安装依赖：

```bash
# 进入容器
docker exec -it backend-gateway sh

# 在容器内安装（需要 root 权限，但容器使用的是 nestjs 用户）
# 需要切换到 root 或修改 Dockerfile 允许安装
```

## 5. 常见问题

1. **缓存问题**：使用 `--no-cache` 重新构建
2. **lockfile 不同步**：确保 `pnpm-lock.yaml` 已更新
3. **依赖分类错误**：确保 `@nestjs/axios` 在 `dependencies` 而不是 `devDependencies`
