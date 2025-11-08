# Vercel + Cloudflare Tunnel 部署配置指南

## 架构说明

### 当前架构

```
用户浏览器
    ↓
Vercel主服务 (ai.zalem.app)
    ↓ /api/ai/ask
Cloudflare Tunnel (ai-service.zalem.app)
    ↓
本地AI服务 (localhost:8788)
```

### 域名分配

- **ai.zalem.app** → Vercel主服务（已配置）
- **ai-service.zalem.app** → Cloudflare Tunnel（本地AI服务）

## 配置步骤

### 1. 配置 Cloudflare Tunnel

#### 1.1 更新配置文件

编辑 `~/.cloudflared/config.yml`：

```yaml
tunnel: 4ee594fd-910d-4a89-9c34-79ca705493e0
credentials-file: /Users/leoventory/.cloudflared/4ee594fd-910d-4a89-9c34-79ca705493e0.json

ingress:
  - hostname: ai-service.zalem.app
    service: http://localhost:8788
  - service: http_status:404
```

#### 1.2 配置DNS路由

```bash
cloudflared tunnel route dns local-ai-service ai-service.zalem.app
```

#### 1.3 启动隧道

```bash
# 开发环境（前台运行）
cloudflared tunnel run local-ai-service

# 生产环境（后台运行）
sudo cloudflared service install
sudo cloudflared service start
```

### 2. 配置 Vercel 环境变量

在 Vercel Dashboard > Settings > Environment Variables 中添加：

#### Production 环境

```bash
# 启用本地AI服务
USE_LOCAL_AI=true

# Cloudflare Tunnel的公共URL
LOCAL_AI_SERVICE_URL=https://ai-service.zalem.app

# 本地AI服务的认证令牌
LOCAL_AI_SERVICE_TOKEN=local_ai_token_dev_12345

# 备用在线AI服务（如果本地服务不可用）
AI_SERVICE_URL=https://zalem.onrender.com
AI_SERVICE_TOKEN=0c2a86471894beb557d858775a3217f6
```

#### Preview 环境

```bash
# Preview环境也可以使用本地AI服务（通过Cloudflare Tunnel）
USE_LOCAL_AI=true
LOCAL_AI_SERVICE_URL=https://ai-service.zalem.app
LOCAL_AI_SERVICE_TOKEN=local_ai_token_dev_12345

# 备用在线AI服务
AI_SERVICE_URL=https://zalem.onrender.com
AI_SERVICE_TOKEN=0c2a86471894beb557d858775a3217f6
```

### 3. 验证配置

#### 3.1 测试 Cloudflare Tunnel

```bash
# 测试健康检查
curl https://ai-service.zalem.app/healthz

# 测试API端点
curl -X POST https://ai-service.zalem.app/v1/ask \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer local_ai_token_dev_12345" \
  -d '{"question": "测试", "lang": "zh"}'
```

#### 3.2 测试 Vercel 主服务

```bash
# 测试主服务API（应该转发到本地AI服务）
curl -X POST https://ai.zalem.app/api/ai/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "测试", "locale": "zh-CN"}'
```

#### 3.3 检查响应头

```bash
curl -I -X POST https://ai.zalem.app/api/ai/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "测试", "locale": "zh-CN"}'
```

期望的响应头：
```
x-ai-service-mode: local
x-ai-service-url: https://ai-service.zalem.app
```

### 4. 本地开发环境配置

本地开发时，`.env.local` 配置：

```bash
# 本地开发使用本地服务
USE_LOCAL_AI=true
LOCAL_AI_SERVICE_URL=http://localhost:8788
LOCAL_AI_SERVICE_TOKEN=local_ai_token_dev_12345

# 备用在线AI服务
AI_SERVICE_URL=https://zalem.onrender.com
AI_SERVICE_TOKEN=0c2a86471894beb557d858775a3217f6
```

## 服务优先级

主站路由 `/api/ai/ask` 的服务选择优先级：

1. **URL参数** (`?ai=local` 或 `?ai=online`) - 最高优先级
2. **数据库配置** (`ai_config.aiProvider`) - 中等优先级
3. **环境变量** (`USE_LOCAL_AI`) - 默认优先级

## 故障排查

### 问题1：Vercel无法访问本地AI服务

**原因**：Vercel无法访问 `localhost:8788`

**解决**：使用 Cloudflare Tunnel 的公共URL `https://ai-service.zalem.app`

### 问题2：DNS解析失败

**检查**：
```bash
nslookup ai-service.zalem.app
```

**解决**：确保DNS记录指向 Cloudflare Tunnel：
- 类型：CNAME
- 值：`4ee594fd-910d-4a89-9c34-79ca705493e0.cfargotunnel.com`

### 问题3：Cloudflare Tunnel未运行

**检查**：
```bash
ps aux | grep cloudflared
cloudflared tunnel info local-ai-service
```

**解决**：重启隧道
```bash
cloudflared tunnel run local-ai-service
```

### 问题4：本地AI服务未运行

**检查**：
```bash
lsof -i :8788
curl http://127.0.0.1:8788/healthz
```

**解决**：启动本地AI服务
```bash
cd apps/local-ai-service
pnpm dev
```

## 监控和维护

### 检查服务状态

```bash
# 检查Cloudflare Tunnel
cloudflared tunnel info local-ai-service

# 检查本地AI服务
curl http://127.0.0.1:8788/healthz

# 检查公共URL
curl https://ai-service.zalem.app/healthz
```

### 查看日志

```bash
# Cloudflare Tunnel日志
tail -f /tmp/cloudflare-tunnel.log

# 本地AI服务日志
tail -f /tmp/local-ai.log
```

## 总结

### ✅ 配置清单

- [x] Cloudflare Tunnel配置文件已更新
- [x] DNS路由已配置（ai-service.zalem.app）
- [x] 隧道已启动并运行
- [ ] Vercel环境变量已配置（需要在Vercel Dashboard中配置）
- [ ] 测试验证通过

### 📝 下一步操作

1. 在 Vercel Dashboard 中配置环境变量
2. 等待DNS记录生效（通常几分钟）
3. 测试验证配置
4. 监控服务状态

