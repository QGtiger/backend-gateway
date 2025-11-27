# Docker 部署文档

本文档介绍如何使用 Docker 和 Docker Compose 部署 backend-gateway 应用。

## 前置要求

- Docker >= 20.10
- Docker Compose >= 2.0

## 快速开始

### 1. 构建镜像

```bash
docker-compose build
```

或者使用 Docker 直接构建：

```bash
docker build -t backend-gateway:latest .
```

### 2. 启动服务

```bash
docker-compose up -d
```

### 3. 查看日志

```bash
docker-compose logs -f backend-gateway
```

### 4. 停止服务

```bash
docker-compose down
```

## 配置说明

### 环境变量

在 `docker-compose.yml` 中，你可以通过 `environment` 部分配置环境变量。常用的环境变量包括：

- `PORT`: 应用端口（默认: 3000）
- `NODE_ENV`: 运行环境（production/development）
- `JWT_SECRET`: JWT 密钥（如果使用 JWT 认证）
- 其他自定义环境变量

### 端口映射

默认端口映射为 `3000:3000`，你可以在 `docker-compose.yml` 中修改：

```yaml
ports:
  - "8080:3000"  # 将容器内的 3000 端口映射到主机的 8080 端口
```

### 网络配置

服务默认连接到 `gateway-network` 网络。如果需要与其他服务通信，可以：

1. 使用相同的网络
2. 或者修改网络配置

## 常用操作

### 查看运行状态

```bash
docker-compose ps
```

### 查看容器日志

```bash
# 实时查看日志
docker-compose logs -f backend-gateway

# 查看最近 100 行日志
docker-compose logs --tail=100 backend-gateway
```

### 进入容器

```bash
docker-compose exec backend-gateway sh
```

### 重启服务

```bash
docker-compose restart backend-gateway
```

### 更新服务

```bash
# 停止服务
docker-compose down

# 重新构建镜像
docker-compose build --no-cache

# 启动服务
docker-compose up -d
```

### 查看资源使用情况

```bash
docker stats backend-gateway
```

## 健康检查

容器配置了健康检查，默认每 30 秒检查一次。健康检查会访问 `/health` 端点。

**注意**: 如果应用没有 `/health` 端点，健康检查可能会失败。你可以：

1. 在应用中添加健康检查端点
2. 或者修改 `docker-compose.yml` 中的健康检查配置

## 生产环境部署建议

### 1. 使用环境变量文件

创建 `.env` 文件：

```env
PORT=3000
NODE_ENV=production
JWT_SECRET=your-secret-key
```

然后在 `docker-compose.yml` 中引用：

```yaml
env_file:
  - .env
```

### 2. 配置资源限制

在 `docker-compose.yml` 中添加资源限制：

```yaml
deploy:
  resources:
    limits:
      cpus: '1'
      memory: 512M
    reservations:
      cpus: '0.5'
      memory: 256M
```

### 3. 配置日志驱动

```yaml
logging:
  driver: "json-file"
  options:
    max-size: "10m"
    max-file: "3"
```

### 4. 使用外部网络

如果需要与其他服务通信，可以使用外部网络：

```yaml
networks:
  gateway-network:
    external: true
    name: my-network
```

### 5. 数据持久化

如果需要持久化数据（如日志），可以配置卷：

```yaml
volumes:
  - ./logs:/app/logs
  - ./data:/app/data
```

## 故障排查

### 容器无法启动

1. 查看日志：`docker-compose logs backend-gateway`
2. 检查端口是否被占用：`lsof -i :3000`
3. 检查镜像是否正确构建：`docker images | grep backend-gateway`

### 应用无法访问

1. 检查容器是否运行：`docker-compose ps`
2. 检查端口映射是否正确
3. 检查防火墙设置
4. 检查应用日志中的错误信息

### 性能问题

1. 查看资源使用：`docker stats backend-gateway`
2. 检查应用日志中的性能相关信息
3. 考虑增加资源限制或优化应用代码

## 多环境部署

### 开发环境

```bash
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up
```

### 生产环境

```bash
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up
```

你可以创建不同的 compose 文件来覆盖不同环境的配置。

## 清理

### 停止并删除容器

```bash
docker-compose down
```

### 删除容器、网络和卷

```bash
docker-compose down -v
```

### 删除镜像

```bash
docker rmi backend-gateway:latest
```

### 清理未使用的资源

```bash
docker system prune -a
```

## 安全建议

1. **不要将敏感信息硬编码**：使用环境变量或密钥管理服务
2. **定期更新基础镜像**：保持 Node.js 镜像为最新版本
3. **使用非 root 用户**：Dockerfile 中已配置使用非 root 用户运行
4. **限制资源使用**：配置资源限制防止资源耗尽
5. **扫描镜像漏洞**：使用 `docker scan` 或第三方工具扫描镜像

## 监控和日志

### 日志管理

- 使用日志驱动收集日志
- 配置日志轮转防止磁盘空间耗尽
- 考虑使用集中式日志管理系统（如 ELK、Loki 等）

### 监控

- 使用健康检查端点监控应用状态
- 集成监控系统（如 Prometheus、Grafana）
- 设置告警规则

## 常见问题

### Q: 如何查看应用的实时日志？

A: 使用 `docker-compose logs -f backend-gateway` 命令。

### Q: 如何修改应用配置？

A: 修改 `docker-compose.yml` 中的 `environment` 部分，然后重启服务。

### Q: 容器启动后立即退出怎么办？

A: 查看日志找出错误原因，通常是配置问题或依赖问题。

### Q: 如何备份数据？

A: 如果使用了数据卷，备份对应的目录即可。

## 相关资源

- [Docker 官方文档](https://docs.docker.com/)
- [Docker Compose 文档](https://docs.docker.com/compose/)
- [NestJS 部署文档](https://docs.nestjs.com/)

## 支持

如有问题，请查看项目日志或联系开发团队。

