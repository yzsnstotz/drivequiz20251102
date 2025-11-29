# Cloudflare Tunnel 快速开始指南

## 一步到位配置 Cloudflare Tunnel

### 前提条件

1. 有 Cloudflare 账号（免费）
2. 有域名（可选，但推荐）
3. 本地 AI 服务正在运行（端口 8788）

### 快速开始

#### 方法 1：使用自动化脚本（推荐）

```bash
# 基本用法（使用临时 URL）
./scripts/setup-cloudflare-tunnel.sh

# 指定端口
./scripts/setup-cloudflare-tunnel.sh 8788

# 指定端口和隧道名称
./scripts/setup-cloudflare-tunnel.sh 8788 local-ai-service

# 指定端口、隧道名称和域名（完整配置）
./scripts/setup-cloudflare-tunnel.sh 8788 local-ai-service ai.yourdomain.com
```

#### 方法 2：手动配置

### 步骤 1：安装 cloudflared

```bash
# macOS
brew install cloudflared

# 或访问
# https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/
```

### 步骤 2：登录 Cloudflare

```bash
# 打开浏览器登录
cloudflared tunnel login
```

这会打开浏览器，选择你的域名，然后授权。

### 步骤 3：创建隧道

```bash
# 创建隧道
cloudflared tunnel create local-ai-service
```

### 步骤 4：配置 DNS（如果有域名）

```bash
# 配置 DNS 记录（将 ai.yourdomain.com 指向隧道）
cloudflared tunnel route dns local-ai-service ai.yourdomain.com
```

**如果没有域名**：
- 可以使用 Cloudflare 提供的临时 URL
- 或使用 Cloudflare Zero Trust 的免费域名

### 步骤 5：创建配置文件

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

### 步骤 6：启动隧道

#### 方式 1：直接运行（开发测试）

```bash
# 启动隧道
cloudflared tunnel run local-ai-service
```

#### 方式 2：作为服务运行（生产环境）

```bash
# macOS
sudo cloudflared service install
sudo cloudflared service start

# 查看服务状态
sudo cloudflared service status

# 停止服务
sudo cloudflared service stop
```

### 步骤 7：在 Vercel Production 中配置

在 Vercel Dashboard > Settings > Environment Variables 中添加：

```bash
USE_LOCAL_AI=true
LOCAL_AI_SERVICE_URL=https://ai.yourdomain.com
LOCAL_AI_SERVICE_TOKEN=local_ai_token_dev_12345
```

### 步骤 8：验证配置

```bash
# 测试健康检查端点
curl https://ai.yourdomain.com/healthz

# 测试 API 端点
curl -X POST https://ai.yourdomain.com/v1/ask \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer local_ai_token_dev_12345" \
  -d '{"question": "测试", "lang": "zh"}'
```

## 完整示例

### 1. 使用脚本快速设置

```bash
# 假设你有域名 yourdomain.com
./scripts/setup-cloudflare-tunnel.sh 8788 local-ai-service ai.yourdomain.com
```

### 2. 启动隧道

```bash
# 开发测试（前台运行）
cloudflared tunnel run local-ai-service

# 或作为服务运行（后台运行）
sudo cloudflared service install
sudo cloudflared service start
```

### 3. 配置 Vercel

在 Vercel Dashboard 中设置环境变量：
- `USE_LOCAL_AI=true`
- `LOCAL_AI_SERVICE_URL=https://ai.yourdomain.com`
- `LOCAL_AI_SERVICE_TOKEN=your_token_here`

### 4. 测试生产环境

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
x-ai-service-url: https://ai.yourdomain.com
```

## 常见问题

### Q1: 没有域名怎么办？

**A**: 可以使用 Cloudflare Zero Trust 的免费域名，或使用临时 URL。

### Q2: 如何查看隧道状态？

**A**: 
```bash
# 查看所有隧道
cloudflared tunnel list

# 查看隧道详细信息
cloudflared tunnel info local-ai-service
```

### Q3: 如何更新配置？

**A**: 
1. 编辑 `~/.cloudflared/config.yml`
2. 重启隧道：
   ```bash
   # 如果作为服务运行
   sudo cloudflared service restart
   
   # 如果直接运行，停止后重新启动
   ```

### Q4: 如何删除隧道？

**A**: 
```bash
# 删除隧道
cloudflared tunnel delete local-ai-service

# 删除 DNS 记录
cloudflared tunnel route dns delete ai.yourdomain.com
```

### Q5: 隧道无法连接怎么办？

**A**: 
1. 检查本地服务是否运行：`lsof -i :8788`
2. 检查配置文件是否正确
3. 查看日志：`cloudflared tunnel run local-ai-service --loglevel debug`
4. 检查防火墙设置

## 优势

✅ **完全免费**：Cloudflare Tunnel 完全免费
✅ **稳定可靠**：由 Cloudflare 提供，稳定性高
✅ **可自定义域名**：可以使用自己的域名
✅ **支持 HTTPS**：自动提供 SSL 证书
✅ **无连接限制**：没有连接数或带宽限制
✅ **适合生产环境**：稳定可靠，适合长期使用

## 注意事项

1. **保持隧道运行**：隧道需要持续运行才能访问本地服务
2. **本地服务必须运行**：确保本地 AI 服务在端口 8788 上运行
3. **认证令牌**：确保配置了 `SERVICE_TOKENS` 保护服务
4. **监控日志**：定期检查隧道日志，确保正常运行

## 下一步

- 详细配置说明：[EXPOSE_LOCAL_SERVER.md](./EXPOSE_LOCAL_SERVER.md)
- 生产环境配置：[PRODUCTION_ENV_GUIDE.md](./PRODUCTION_ENV_GUIDE.md)

