# 部署到阿里云服务器指南

## 当前部署方式

当前项目使用 GitHub Actions 自动构建 Docker 镜像，推送到阿里云容器镜像服务（ACR），再通过 SSH 登录服务器执行 `docker pull` 和 `docker run` 完成发布。

相关文件：
- [Dockerfile](Dockerfile)
- [.github/workflows/deploy.yml](.github/workflows/deploy.yml)
- [next.config.ts](next.config.ts)

## 前置准备

### 1. GitHub Secrets

在 GitHub 仓库的 `Settings -> Secrets and variables -> Actions` 中配置：

- `ACR_REGISTRY`：ACR registry 地址，例如 `registry.cn-hangzhou.aliyuncs.com`
- `ACR_NAMESPACE`：ACR 命名空间，例如 `your-namespace`
- `ACR_USERNAME`：ACR 用户名
- `ACR_PASSWORD`：ACR 密码
- `SERVER_HOST`：服务器 IP 或域名
- `SERVER_USER`：服务器登录用户
- `SERVER_SSH_KEY`：GitHub Actions 用于 SSH 登录服务器的私钥

最终镜像名格式为：
```text
$ACR_REGISTRY/$ACR_NAMESPACE/photo-to-3d:latest
```

### 2. 服务器环境要求

- Docker
- Nginx
- 可通过 SSH 登录
- 开放 22、80、443 端口

## 服务器初始化

### 1. 安装 Docker

Ubuntu / Debian：
```bash
apt update
apt install -y docker.io
systemctl enable docker
systemctl start docker
```

CentOS：
```bash
yum install -y docker
systemctl enable docker
systemctl start docker
```

### 2. 安装 Nginx

Ubuntu / Debian：
```bash
apt update
apt install -y nginx
```

CentOS：
```bash
yum install -y nginx
```

### 3. 验证 Docker 可用

```bash
docker --version
```

## 自动部署流程

当代码 push 到 `main` 分支时，GitHub Actions 会自动执行：

1. 拉取代码
2. 登录 ACR
3. 构建 Docker 镜像
4. 推送两个 tag：
   - `${GITHUB_SHA}`
   - `latest`
5. SSH 登录服务器
6. 在服务器上执行：
   - `docker login`
   - `docker pull`
   - 停止旧容器
   - 删除旧容器
   - 启动新容器

容器启动命令等价于：
```bash
docker run -d \
  --name photo-to-3d \
  --restart unless-stopped \
  -p 3000:3000 \
  registry.cn-hangzhou.aliyuncs.com/your-namespace/photo-to-3d:latest
```

## Nginx 反向代理

建议让 Nginx 监听 80/443，再反向代理到容器的 3000 端口。

示例配置：
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

启用配置：
```bash
nginx -t
systemctl restart nginx
```

## 更新部署

每次提交到 `main` 后会自动部署，无需手动登录服务器执行发布命令。

## 故障排查

### 查看 GitHub Actions 日志

在 GitHub 仓库的 `Actions` 页面查看 `Deploy to Aliyun` workflow 日志。

### 查看服务器容器状态

```bash
docker ps -a
```

### 查看应用日志

```bash
docker logs -f photo-to-3d
```

### 手动重启容器

```bash
docker restart photo-to-3d
```

### 手动拉取最新镜像并重建

```bash
docker login registry.cn-hangzhou.aliyuncs.com
docker pull registry.cn-hangzhou.aliyuncs.com/your-namespace/photo-to-3d:latest
docker stop photo-to-3d || true
docker rm photo-to-3d || true
docker run -d \
  --name photo-to-3d \
  --restart unless-stopped \
  -p 3000:3000 \
  registry.cn-hangzhou.aliyuncs.com/your-namespace/photo-to-3d:latest
```

### 查看 Nginx 日志

```bash
tail -f /var/log/nginx/error.log
tail -f /var/log/nginx/access.log
```

## 访问应用

- 直接访问：`http://your-server-ip:3000`
- 反向代理后：`http://your-domain.com`
- 配置 SSL 后：`https://your-domain.com`
