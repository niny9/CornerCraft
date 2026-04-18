# 部署到阿里云服务器指南

## 前置准备

### 1. 服务器环境要求
- Node.js 18+
- Nginx
- PM2（进程管理器）

### 2. 在服务器上安装环境

SSH登录到你的阿里云服务器：
```bash
ssh root@your-server-ip
```

安装Node.js：
```bash
# 使用nvm安装（推荐）
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 18
nvm use 18
```

安装PM2：
```bash
npm install -g pm2
```

安装Nginx：
```bash
# Ubuntu/Debian
apt update
apt install nginx

# CentOS
yum install nginx
```

## 部署方式

### 方式一：使用自动部署脚本（推荐）

1. 修改 `deploy.sh` 中的配置：
```bash
SERVER_USER="root"  # 你的服务器用户名
SERVER_IP="your-server-ip"  # 你的服务器IP
```

2. 确保可以SSH免密登录服务器：
```bash
# 生成SSH密钥（如果还没有）
ssh-keygen -t rsa

# 复制公钥到服务器
ssh-copy-id root@your-server-ip
```

3. 运行部署脚本：
```bash
./deploy.sh
```

### 方式二：手动部署

#### 步骤1：本地构建
```bash
npm run build
```

#### 步骤2：上传文件到服务器
```bash
# 打包必要文件
tar -czf photo-to-3d.tar.gz .next public package.json package-lock.json ecosystem.config.js next.config.ts

# 上传到服务器
scp photo-to-3d.tar.gz root@your-server-ip:/tmp/
```

#### 步骤3：在服务器上部署
SSH登录服务器后执行：
```bash
# 创建部署目录
mkdir -p /var/www/photo-to-3d
cd /var/www/photo-to-3d

# 解压文件
tar -xzf /tmp/photo-to-3d.tar.gz

# 安装依赖
npm ci --production

# 启动应用
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # 设置开机自启
```

## 配置Nginx反向代理

1. 复制Nginx配置：
```bash
scp nginx.conf root@your-server-ip:/etc/nginx/sites-available/photo-to-3d
```

2. 在服务器上启用配置：
```bash
# 创建软链接
ln -s /etc/nginx/sites-available/photo-to-3d /etc/nginx/sites-enabled/

# 测试配置
nginx -t

# 重启Nginx
systemctl restart nginx
```

3. 修改 `nginx.conf` 中的域名：
```nginx
server_name your-domain.com;  # 替换为你的域名或IP
```

## 配置域名（可选）

如果你有域名：

1. 在域名DNS设置中添加A记录指向服务器IP
2. 修改 `nginx.conf` 中的 `server_name`
3. 配置SSL证书（推荐使用Let's Encrypt）：

```bash
# 安装certbot
apt install certbot python3-certbot-nginx

# 获取证书
certbot --nginx -d your-domain.com
```

## 常用PM2命令

```bash
pm2 list              # 查看所有应用
pm2 logs photo-to-3d  # 查看日志
pm2 restart photo-to-3d  # 重启应用
pm2 stop photo-to-3d  # 停止应用
pm2 delete photo-to-3d  # 删除应用
pm2 monit             # 监控应用
```

## 防火墙配置

确保开放必要的端口：
```bash
# 阿里云安全组规则中开放：
# - 80 (HTTP)
# - 443 (HTTPS)
# - 22 (SSH)

# 如果使用ufw防火墙：
ufw allow 80
ufw allow 443
ufw allow 22
```

## 更新部署

每次更新代码后，只需运行：
```bash
./deploy.sh
```

或手动执行：
```bash
npm run build
# 上传文件...
# 在服务器上：
pm2 restart photo-to-3d
```

## 故障排查

查看应用日志：
```bash
pm2 logs photo-to-3d
```

查看Nginx日志：
```bash
tail -f /var/log/nginx/error.log
tail -f /var/log/nginx/access.log
```

检查端口占用：
```bash
netstat -tlnp | grep 3000
```

## 性能优化建议

1. 启用Nginx gzip压缩
2. 配置静态文件缓存
3. 使用CDN加速静态资源
4. 根据服务器配置调整PM2实例数量

## 访问应用

- 直接访问：`http://your-server-ip`
- 域名访问：`http://your-domain.com`
- HTTPS访问：`https://your-domain.com`（配置SSL后）
