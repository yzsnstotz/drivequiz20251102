# 将本地服务器暴露为公共服务器指南

## 概述

将本地 AI 服务暴露为公共服务器，可以让 Preview/Production 环境访问你的本地服务。有多种方案可以实现，每种方案都有其优缺点。

## 方案对比

| 方案 | 优点 | 缺点 | 适用场景 |
|------|------|------|----------|
| **ngrok** | 简单快速、免费版可用 | 免费版 URL 会变化、有连接限制 | 开发测试 |
| **Cloudflare Tunnel** | 免费、稳定、可自定义域名 | 配置稍复杂 | 生产使用 |
| **localtunnel** | 免费、简单 | URL 会变化、可能不稳定 | 临时测试 |
| **公网 IP + 端口转发** | 完全控制、稳定 | 需要路由器配置、安全风险 | 长期使用 |

## 方案 1：使用 ngrok（推荐用于开发测试）

### 安装 ngrok

```bash
# macOS
brew install ngrok

# 或下载二进制文件
# https://ngrok.com/download
```

### 注册并获取 token

1. 访问 [ngrok.com](https://ngrok.com) 注册账号
2. 获取 authtoken
3. 配置 token：

```bash
ngrok config add-authtoken YOUR_AUTH_TOKEN
```

### 暴露本地服务

```bash
# 暴露本地 AI 服务（端口 8788）
ngrok http 8788
```

**输出示例**：
```
Forwarding   https://abc123.ngrok-free.app -> http://localhost:8788
```

### 使用固定域名（付费版）

```bash
# 使用固定域名（需要付费版）
ngrok http 8788 --domain=your-domain.ngrok.app
```

### 在 Vercel 中配置

```bash
# Vercel Production 环境变量
USE_LOCAL_AI=true
LOCAL_AI_SERVICE_URL=https://abc123.ngrok-free.app
LOCAL_AI_SERVICE_TOKEN=local_ai_token_dev_12345
```

### 优点
- ✅ 简单快速
- ✅ 免费版可用
- ✅ 支持 HTTPS
- ✅ 自动处理 SSL 证书

### 缺点
- ❌ 免费版 URL 每次启动都会变化
- ❌ 免费版有连接数限制
- ❌ 免费版有带宽限制

## 方案 2：使用 Cloudflare Tunnel（推荐用于生产）

### 快速开始（使用脚本）

```bash
# 使用自动化脚本（推荐）
./scripts/setup-cloudflare-tunnel.sh 8788 local-ai-service ai.yourdomain.com
```

脚本会自动完成：
- ✅ 检查 cloudflared 是否安装
- ✅ 检查登录状态
- ✅ 创建隧道
- ✅ 配置 DNS
- ✅ 创建配置文件

**详细说明**：请参考 [CLOUDFLARE_TUNNEL_QUICK_START.md](./CLOUDFLARE_TUNNEL_QUICK_START.md)

### 手动配置步骤

#### 1. 安装 cloudflared

```bash
# macOS
brew install cloudflared

# 或下载二进制文件
# https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/
```

#### 2. 登录 Cloudflare

```bash
# 打开浏览器登录
cloudflared tunnel login
```

#### 3. 创建隧道

```bash
# 创建隧道
cloudflared tunnel create local-ai-service

# 配置 DNS（如果有域名）
cloudflared tunnel route dns local-ai-service ai.yourdomain.com
```

#### 4. 创建配置文件

创建 `~/.cloudflared/config.yml`：

```yaml
tunnel: YOUR_TUNNEL_ID
credentials-file: /Users/your-username/.cloudflared/YOUR_TUNNEL_ID.json

ingress:
  - hostname: ai.yourdomain.com
    service: http://localhost:8788
  - service: http_status:404
```

**获取隧道 ID**：
```bash
cloudflared tunnel list
```

#### 5. 启动隧道

```bash
# 启动隧道（前台运行）
cloudflared tunnel run local-ai-service

# 或作为服务运行（后台运行，macOS）
sudo cloudflared service install
sudo cloudflared service start
```

#### 6. 在 Vercel 中配置

```bash
# Vercel Production 环境变量
USE_LOCAL_AI=true
LOCAL_AI_SERVICE_URL=https://ai.yourdomain.com
LOCAL_AI_SERVICE_TOKEN=local_ai_token_dev_12345
```

### 优点
- ✅ 完全免费
- ✅ 稳定可靠
- ✅ 可自定义域名
- ✅ 支持 HTTPS
- ✅ 无连接数限制

### 缺点
- ❌ 配置稍复杂
- ❌ 需要域名

## 方案 3：使用 localtunnel（临时测试）

### 安装 localtunnel

```bash
npm install -g localtunnel
```

### 暴露本地服务

```bash
# 暴露本地 AI 服务
lt --port 8788

# 使用自定义子域名（需要注册）
lt --port 8788 --subdomain your-subdomain
```

### 在 Vercel 中配置

```bash
# Vercel Production 环境变量
USE_LOCAL_AI=true
LOCAL_AI_SERVICE_URL=https://your-subdomain.loca.lt
LOCAL_AI_SERVICE_TOKEN=local_ai_token_dev_12345
```

### 优点
- ✅ 完全免费
- ✅ 简单快速
- ✅ 无需注册

### 缺点
- ❌ URL 会变化（除非使用自定义子域名）
- ❌ 可能不稳定
- ❌ 不适合生产使用

## 方案 4：使用公网 IP + 端口转发

### 前提条件

1. 有公网 IP 地址
2. 可以配置路由器端口转发
3. 有固定 IP 或使用动态 DNS

### 配置步骤

#### 1. 配置路由器端口转发

在路由器管理界面配置：
- **外部端口**：8788（或自定义）
- **内部 IP**：你的本地机器 IP（如 192.168.1.100）
- **内部端口**：8788
- **协议**：TCP

#### 2. 配置防火墙

```bash
# macOS 防火墙设置
# 系统偏好设置 > 安全性与隐私 > 防火墙 > 防火墙选项
# 允许 Node.js 接受传入连接
```

#### 3. 确保服务监听 0.0.0.0

确保本地 AI 服务监听 `0.0.0.0` 而不是 `127.0.0.1`：

```bash
# 在 apps/local-ai-service/.env.local 中设置
HOST=0.0.0.0
PORT=8788
```

#### 4. 获取公网 IP

```bash
# 查看公网 IP
curl ifconfig.me

# 或使用动态 DNS（如 DuckDNS、No-IP）
```

#### 5. 在 Vercel 中配置

```bash
# Vercel Production 环境变量
USE_LOCAL_AI=true
LOCAL_AI_SERVICE_URL=http://YOUR_PUBLIC_IP:8788
# 或使用动态 DNS
LOCAL_AI_SERVICE_URL=http://your-domain.duckdns.org:8788
LOCAL_AI_SERVICE_TOKEN=local_ai_token_dev_12345
```

### 优点
- ✅ 完全控制
- ✅ 稳定可靠
- ✅ 无第三方依赖

### 缺点
- ❌ 需要路由器配置
- ❌ 安全风险（暴露到公网）
- ❌ 需要固定 IP 或动态 DNS
- ❌ 不支持 HTTPS（除非配置反向代理）

## 方案 5：使用 Serveo（SSH 隧道）

### 使用 SSH 隧道

```bash
# 使用 Serveo（无需安装）
ssh -R 80:localhost:8788 serveo.net

# 或使用自定义子域名
ssh -R your-subdomain:80:localhost:8788 serveo.net
```

### 在 Vercel 中配置

```bash
# Vercel Production 环境变量
USE_LOCAL_AI=true
LOCAL_AI_SERVICE_URL=https://your-subdomain.serveo.net
LOCAL_AI_SERVICE_TOKEN=local_ai_token_dev_12345
```

### 优点
- ✅ 完全免费
- ✅ 无需安装
- ✅ 支持 HTTPS

### 缺点
- ❌ 需要保持 SSH 连接
- ❌ 可能不稳定
- ❌ 不适合生产使用

## 安全性注意事项

### 1. 使用认证令牌

确保本地 AI 服务配置了认证令牌：

```bash
# 在 apps/local-ai-service/.env.local 中设置
SERVICE_TOKENS=your_secure_token_here
```

### 2. 使用 HTTPS

优先使用支持 HTTPS 的方案（ngrok、Cloudflare Tunnel）：

```bash
# 使用 HTTPS URL
LOCAL_AI_SERVICE_URL=https://your-domain.com
```

### 3. 限制访问

考虑添加 IP 白名单或使用防火墙规则限制访问。

### 4. 定期更换令牌

定期更换认证令牌，避免泄露。

### 5. 监控日志

监控本地服务的访问日志，及时发现异常。

## 推荐方案

### 开发测试环境
- **推荐**：ngrok（简单快速）
- **备选**：localtunnel（无需注册）

### 生产环境
- **推荐**：Cloudflare Tunnel（免费、稳定、可自定义域名）
- **备选**：部署到云端（Render、Railway 等）

## 验证配置

### 1. 测试公共 URL

```bash
# 测试健康检查端点
curl https://your-public-url.com/healthz

# 测试 API 端点
curl -X POST https://your-public-url.com/v1/ask \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your_token" \
  -d '{"question": "测试", "lang": "zh"}'
```

### 2. 在 Vercel 中测试

```bash
# 测试生产环境 API
curl -I -X POST https://your-production-url.vercel.app/api/ai/ask?ai=local \
  -H "Content-Type: application/json" \
  -d '{"question":"test","locale":"zh"}'
```

**期望的响应头**：
```
x-route-fingerprint: ask-route-fp-*
x-ai-service-mode: local
x-ai-service-url: https://your-public-url.com
```

## 常见问题

### Q1: 哪种方案最适合生产环境？

**A**: Cloudflare Tunnel 最适合生产环境，因为：
- 完全免费
- 稳定可靠
- 可自定义域名
- 支持 HTTPS
- 无连接数限制

### Q2: ngrok 免费版可以用于生产吗？

**A**: 不推荐，因为：
- URL 每次启动都会变化
- 有连接数和带宽限制
- 可能不稳定

### Q3: 如何确保安全性？

**A**: 
1. 使用认证令牌
2. 使用 HTTPS
3. 限制访问（IP 白名单）
4. 定期更换令牌
5. 监控日志

### Q4: 本地服务需要监听 0.0.0.0 吗？

**A**: 是的，如果使用公网 IP + 端口转发方案，需要监听 `0.0.0.0`。其他方案（ngrok、Cloudflare Tunnel）不需要，因为它们会转发到 `localhost`。

## 总结

- ✅ **可以**将本地服务器暴露为公共服务器
- ✅ **推荐方案**：
  - 开发测试：ngrok
  - 生产环境：Cloudflare Tunnel
- ⚠️ **注意安全性**：使用认证令牌、HTTPS、监控日志
- 📝 **配置步骤**：暴露服务 → 获取公共 URL → 在 Vercel 中配置环境变量

