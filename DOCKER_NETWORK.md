# Docker Network 创建指南

## 创建 shared-network 网络

你的 `docker-compose.yml` 使用了一个名为 `shared-network` 的外部网络。如果这个网络不存在，需要先创建它。

### 方法 1：使用 docker network create 命令

```bash
# 创建 bridge 类型的网络（默认，适合单机）
docker network create shared-network

# 或者指定驱动类型
docker network create --driver bridge shared-network

# 创建时指定子网（可选）
docker network create --subnet=172.20.0.0/16 shared-network
```

### 方法 2：在 docker-compose.yml 中自动创建

如果你想让 docker-compose 自动创建网络，可以修改配置：

```yaml
networks:
  shared-network:
    driver: bridge
    # 移除 external: true
```

### 方法 3：使用脚本创建

创建一个 `setup-network.sh` 脚本：

```bash
#!/bin/bash
if ! docker network ls | grep -q "shared-network"; then
    echo "创建 shared-network 网络..."
    docker network create shared-network
    echo "网络创建成功！"
else
    echo "shared-network 网络已存在"
fi
```

## 常用 Docker Network 命令

### 查看所有网络

```bash
docker network ls
```

### 查看网络详情

```bash
docker network inspect shared-network
```

### 查看连接到网络的容器

```bash
docker network inspect shared-network --format '{{range .Containers}}{{.Name}} {{end}}'
```

### 删除网络

```bash
# 注意：只能删除没有容器连接的网络
docker network rm shared-network
```

### 强制删除网络（断开所有连接）

```bash
docker network rm -f shared-network
```

### 连接容器到网络

```bash
docker network connect shared-network container-name
```

### 断开容器与网络

```bash
docker network disconnect shared-network container-name
```

## 网络类型说明

- **bridge**（默认）：单机网络，容器可以通过 IP 或容器名通信
- **host**：使用主机网络，容器直接使用主机网络栈
- **overlay**：多主机网络，用于 Docker Swarm
- **macvlan**：给容器分配 MAC 地址，使其在物理网络中可见
- **none**：禁用网络

## 在 ECS 服务器上创建网络

```bash
# SSH 连接到服务器后执行
docker network create shared-network

# 验证创建成功
docker network ls | grep shared-network

# 查看网络详情
docker network inspect shared-network
```

## 故障排查

### 如果遇到 "network shared-network not found" 错误

1. 检查网络是否存在：

   ```bash
   docker network ls | grep shared-network
   ```

2. 如果不存在，创建它：

   ```bash
   docker network create shared-network
   ```

3. 如果已存在但名称不同，可以：
   - 重命名现有网络（Docker 不支持直接重命名，需要创建新的）
   - 或者修改 docker-compose.yml 中的网络名称

### 如果多个服务需要共享网络

确保所有服务的 `docker-compose.yml` 都使用相同的网络名称：

```yaml
networks:
  shared-network:
    external: true
    name: shared-network
```
