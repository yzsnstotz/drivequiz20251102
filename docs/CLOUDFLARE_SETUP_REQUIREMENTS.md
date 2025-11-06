# Cloudflare Tunnel 配置要求

## 1. 需要的 Cloudflare 信息

### ✅ 不需要 API Token

Cloudflare Tunnel **不需要** API Token 或其他 API 凭证。所有认证通过 `cloudflared tunnel login` 自动完成。

### ✅ 需要的信息

#### 1. Cloudflare 账号
- ✅ 已申请（完成）
- 免费账号即可

#### 2. 域名（推荐，但不是必需的）

**如果有域名**：
- 域名需要在 Cloudflare 管理
- 在 Cloudflare Dashboard 中添加域名
- 更新域名的 DNS 服务器为 Cloudflare 提供的服务器

**如果没有域名**：
- 可以使用 Cloudflare Zero Trust 的免费域名
- 或使用临时 URL（每次启动可能变化）

#### 3. 登录凭证（自动获取）

运行 `cloudflared tunnel login` 时：
- 会自动打开浏览器
- 选择你的域名
- 自动授权并获取凭证
- 凭证保存在 `~/.cloudflared/` 目录

**不需要手动输入任何凭证！**

## 2. Vercel 主服务配置

### ✅ 主服务不需要改变

**重要**：你的 Vercel 主服务**完全不需要改变**！

Cloudflare Tunnel 只是：
- 暴露你的**本地 AI 服务**（端口 8788）
- 提供一个公共 URL（如 `https://ai.yourdomain.com`）
- 让 Vercel 主服务可以访问本地 AI 服务

### 架构说明

```
┌─────────────────┐
│  Vercel 主服务   │  ← 保持不变，部署在 Vercel
│  (Next.js Web)  │
└────────┬────────┘
         │
         │ HTTP 请求
         │ (通过环境变量配置的 URL)
         ▼
┌─────────────────┐
│ Cloudflare      │  ← 新的：暴露本地服务
│ Tunnel          │
└────────┬────────┘
         │
         │ 隧道连接
         ▼
┌─────────────────┐
│ 本地 AI 服务     │  ← 运行在你的机器上
│ (端口 8788)     │
└─────────────────┘
```

### 只需要在 Vercel 环境变量中配置

在 Vercel Dashboard > Settings > Environment Variables 中添加：

```bash
# 启用本地 AI 服务
USE_LOCAL_AI=true

# 使用 Cloudflare Tunnel 的公共 URL
LOCAL_AI_SERVICE_URL=https://ai.yourdomain.com

# 本地 AI 服务的认证令牌
LOCAL_AI_SERVICE_TOKEN=local_ai_token_dev_12345
```

**这就是全部！主服务代码不需要任何修改。**

## 3. 完整配置步骤

### 步骤 1：准备域名（如果有）

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 点击 **Add a Site**
3. 输入你的域名（如 `yourdomain.com`）
4. 选择免费计划
5. 按照提示更新域名的 DNS 服务器为 Cloudflare 提供的服务器

**如果没有域名**：
- 可以跳过此步骤
- 使用 Cloudflare Zero Trust 的免费域名

### 步骤 2：安装 cloudflared

```bash
# macOS
brew install cloudflared

# 或访问
# https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/
```

### 步骤 3：登录 Cloudflare

```bash
# 运行登录命令
cloudflared tunnel login
```

**过程**：
1. 会自动打开浏览器
2. 选择你的域名（如果有）
3. 点击 **Authorize**
4. 自动完成认证
5. 凭证保存在 `~/.cloudflared/`

**不需要输入任何凭证！**

### 步骤 4：创建隧道

```bash
# 使用脚本（推荐）
./scripts/setup-cloudflare-tunnel.sh 8788 local-ai-service ai.yourdomain.com

# 或手动创建
cloudflared tunnel create local-ai-service
cloudflared tunnel route dns local-ai-service ai.yourdomain.com
```

### 步骤 5：启动隧道

```bash
# 开发测试（前台运行）
cloudflared tunnel run local-ai-service

# 生产环境（后台运行）
sudo cloudflared service install
sudo cloudflared service start
```

### 步骤 6：在 Vercel 中配置环境变量

在 Vercel Dashboard > Settings > Environment Variables 中添加：

| 变量名 | 值 | 环境 |
|--------|-----|------|
| `USE_LOCAL_AI` | `true` | Production |
| `LOCAL_AI_SERVICE_URL` | `https://ai.yourdomain.com` | Production |
| `LOCAL_AI_SERVICE_TOKEN` | `local_ai_token_dev_12345` | Production |

**注意**：
- 这些变量只影响 Vercel 主服务如何选择 AI 服务
- **不需要修改任何代码**
- **不需要重新部署主服务**

### 步骤 7：验证配置

```bash
# 测试 Cloudflare Tunnel
curl https://ai.yourdomain.com/healthz

# 测试 Vercel 主服务
curl -I -X POST https://your-vercel-app.vercel.app/api/ai/ask?ai=local \
  -H "Content-Type: application/json" \
  -d '{"question":"test","locale":"zh"}'
```

**期望的响应头**：
```
x-route-fingerprint: ask-route-fp-*
x-ai-service-mode: local
x-ai-service-url: https://ai.yourdomain.com
```

## 4. 常见问题

### Q1: 需要 Cloudflare API Token 吗？

**A**: **不需要**。`cloudflared tunnel login` 会自动处理所有认证。

### Q2: 需要修改 Vercel 主服务代码吗？

**A**: **不需要**。只需要在 Vercel 环境变量中配置 URL。

### Q3: 需要重新部署 Vercel 主服务吗？

**A**: **不需要**。环境变量更改后会自动生效（可能需要几分钟）。

### Q4: 如果没有域名怎么办？

**A**: 
- 可以使用 Cloudflare Zero Trust 的免费域名
- 或使用临时 URL（每次启动可能变化）
- 建议使用域名以获得稳定的 URL

### Q5: 本地 AI 服务需要修改吗？

**A**: **不需要**。本地 AI 服务保持原样，只需要确保：
- 监听 `0.0.0.0` 或 `localhost`（Cloudflare Tunnel 会转发）
- 配置了 `SERVICE_TOKENS` 认证

### Q6: 如何查看 Cloudflare Tunnel 状态？

**A**: 
```bash
# 查看所有隧道
cloudflared tunnel list

# 查看隧道信息
cloudflared tunnel info local-ai-service

# 查看服务状态（如果作为服务运行）
sudo cloudflared service status
```

## 5. 总结

### ✅ 需要的 Cloudflare 信息

1. **Cloudflare 账号**（免费即可）✅ 已申请
2. **域名**（可选，但推荐）
   - 需要在 Cloudflare 管理
   - 更新 DNS 服务器为 Cloudflare
3. **登录凭证**（自动获取）
   - 运行 `cloudflared tunnel login`
   - 自动完成认证

### ✅ Vercel 主服务配置

1. **不需要修改代码** ✅
2. **不需要重新部署** ✅
3. **只需要配置环境变量** ✅
   - `USE_LOCAL_AI=true`
   - `LOCAL_AI_SERVICE_URL=https://ai.yourdomain.com`
   - `LOCAL_AI_SERVICE_TOKEN=your_token`

### ✅ 架构

```
Vercel 主服务 (不变)
    ↓
环境变量配置 (新增)
    ↓
Cloudflare Tunnel (新增)
    ↓
本地 AI 服务 (不变)
```

## 6. 快速开始

```bash
# 1. 安装 cloudflared
brew install cloudflared

# 2. 登录 Cloudflare（会自动打开浏览器）
cloudflared tunnel login

# 3. 创建隧道（替换为你的域名）
./scripts/setup-cloudflare-tunnel.sh 8788 local-ai-service ai.yourdomain.com

# 4. 启动隧道
cloudflared tunnel run local-ai-service

# 5. 在 Vercel Dashboard 中配置环境变量
# USE_LOCAL_AI=true
# LOCAL_AI_SERVICE_URL=https://ai.yourdomain.com
# LOCAL_AI_SERVICE_TOKEN=local_ai_token_dev_12345
```

**完成！主服务会自动使用本地 AI 服务。**

