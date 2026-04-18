# GitHub Actions 自动部署指南

## 配置步骤

### 1. 创建GitHub仓库

在GitHub上创建新仓库，然后将本地代码推送上去：

```bash
cd /Users/dreame/Documents/practice/photo-to-3d

# 初始化git仓库（如果还没有）
git init

# 添加远程仓库
git remote add origin https://github.com/你的用户名/photo-to-3d.git

# 添加所有文件
git add .

# 提交
git commit -m "Initial commit"

# 推送到GitHub
git branch -M main
git push -u origin main
```

### 2. 配置GitHub Secrets

在GitHub仓库中配置服务器信息：

1. 进入仓库页面
2. 点击 `Settings` > `Secrets and variables` > `Actions`
3. 点击 `New repository secret` 添加以下密钥：

#### 需要添加的Secrets：

**SERVER_HOST**
- 值：你的阿里云服务器IP地址
- 例如：`123.456.789.0`

**SERVER_USER**
- 值：服务器用户名
- 例如：`root`

**SERVER_SSH_KEY**
- 值：你的SSH私钥内容
- 获取方式：
```bash
# 在本地查看私钥
cat ~/.ssh/id_rsa

# 复制整个内容（包括BEGIN和END行）
```

### 3. 在服务器上添加SSH公钥

确保服务器可以接受GitHub Actions的连接：

```bash
# 在服务器上执行
mkdir -p ~/.ssh
chmod 700 ~/.ssh

# 将你的公钥添加到authorized_keys
cat >> ~/.ssh/authorized_keys << 'EOF'
你的公钥内容
EOF

chmod 600 ~/.ssh/authorized_keys
```

### 4. 测试部署

推送代码到main分支即可触发自动部署：

```bash
git add .
git commit -m "Update code"
git push origin main
```

### 5. 查看部署状态

1. 进入GitHub仓库
2. 点击 `Actions` 标签
3. 查看工作流运行状态

## 工作流说明

`.github/workflows/deploy.yml` 文件定义了自动部署流程：

1. **触发条件**：推送到main分支
2. **构建步骤**：
   - 检出代码
   - 安装Node.js
   - 安装依赖
   - 构建项目
3. **部署步骤**：
   - 上传构建文件到服务器
   - 在服务器上安装依赖
   - 重启PM2应用

## 自定义配置

### 修改触发分支

编辑 `.github/workflows/deploy.yml`：

```yaml
on:
  push:
    branches:
      - main      # 主分支
      - develop   # 开发分支
```

### 添加测试步骤

在build之前添加测试：

```yaml
- name: Run tests
  run: npm test
```

### 部署到多个环境

创建不同的workflow文件：
- `.github/workflows/deploy-staging.yml` - 测试环境
- `.github/workflows/deploy-production.yml` - 生产环境

## 常见问题

### 1. SSH连接失败

检查：
- SERVER_SSH_KEY是否正确（包含完整的BEGIN和END）
- 服务器防火墙是否开放22端口
- 服务器上是否添加了对应的公钥

### 2. 权限问题

确保服务器用户有权限访问部署目录：
```bash
chown -R $USER:$USER /var/www/photo-to-3d
```

### 3. PM2命令未找到

在服务器上全局安装PM2：
```bash
npm install -g pm2
```

### 4. 构建失败

检查：
- package.json中的依赖是否正确
- Node.js版本是否匹配

## 部署流程图

```
本地开发 → git push → GitHub → Actions触发 → 构建 → 部署到服务器 → PM2重启
```

## 回滚方案

如果部署出现问题，可以在服务器上手动回滚：

```bash
cd /var/www/photo-to-3d
git checkout 上一个版本的commit-hash
npm ci --production
pm2 restart ecosystem.config.js
```

## 监控和通知

可以添加部署通知（可选）：

### 钉钉通知

在workflow中添加：
```yaml
- name: Notify DingTalk
  if: always()
  uses: zcong1993/actions-ding@master
  with:
    dingToken: ${{ secrets.DING_TOKEN }}
    body: |
      {
        "msgtype": "text",
        "text": {
          "content": "部署状态: ${{ job.status }}"
        }
      }
```

### 邮件通知

GitHub Actions默认会发送邮件通知部署结果。

## 最佳实践

1. **使用分支保护**：要求PR review后才能合并到main
2. **添加测试**：确保代码质量
3. **环境变量管理**：使用GitHub Secrets管理敏感信息
4. **日志监控**：定期检查PM2日志
5. **备份策略**：定期备份服务器数据

## 手动触发部署

如果需要手动触发部署，修改workflow：

```yaml
on:
  push:
    branches:
      - main
  workflow_dispatch:  # 添加手动触发
```

然后在GitHub Actions页面点击"Run workflow"按钮。
