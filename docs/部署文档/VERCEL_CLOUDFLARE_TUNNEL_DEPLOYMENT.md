# Vercel + Cloudflare Tunnel 完整部署配置指南

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

- **ai.zalem.app** → Vercel主服务（已配置，保持不变）
- **ai-service.zalem.app** → Cloudflare Tunnel（本地AI服务，新配置）

## ✅ 已完成的配置

### 1. Cloudflare Tunnel配置

- ✅ 配置文件已更新：`~/.cloudflared/config.yml`
- ✅ Hostname：`ai-service.zalem.app`
- ✅ 服务：`http://localhost:8788`
- ✅ DNS路由已配置：`ai-service.zalem.app`
- ✅ 隧道已启动并运行

### 2. 本地AI服务

- ✅ 服务正在运行（端口8788）
- ✅ 健康检查正常
- ✅ API端点正常

## 📝 需要在Vercel中配置的环境变量

### Production 环境

在 Vercel Dashboard > Settings > Environment Variables 中添加：

```bash
# 启用本地AI服务（通过Cloudflare Tunnel）
USE_LOCAL_AI=true

# Cloudflare Tunnel的公共URL
LOCAL_AI_SERVICE_URL=https://ai-service.zalem.app

# 本地AI服务的认证令牌
LOCAL_AI_SERVICE_TOKEN=local_ai_token_dev_12345

# 备用在线AI服务（如果本地服务不可用）
AI_SERVICE_URL=https://zalem.onrender.com
AI_SERVICE_TOKEN=0c2a86471894beb557d858775a3217f6
```

### Preview 环境

```bash
# Preview环境也可以使用本地AI服务
USE_LOCAL_AI=true
LOCAL_AI_SERVICE_URL=https://ai-service.zalem.app
LOCAL_AI_SERVICE_TOKEN=local_ai_token_dev_12345

# 备用在线AI服务
AI_SERVICE_URL=https://zalem.onrender.com
AI_SERVICE_TOKEN=0c2a86471894beb557d858775a3217f6
```

## 🔍 验证配置

### 1. 等待DNS生效

DNS记录可能需要几分钟到几小时才能生效。检查DNS解析：

```bash
nslookup ai-service.zalem.app
```

期望看到：
```
ai-service.zalem.app -> 4ee594fd-910d-4a89-9c34-79ca705493e0.cfargotunnel.com
```

### 2. 测试 Cloudflare Tunnel

```bash
# 测试健康检查
curl https://ai-service.zalem.app/healthz

# 测试API端点
curl -X POST https://ai-service.zalem.app/v1/ask \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer local_ai_token_dev_12345" \
  -d '{"question": "测试", "lang": "zh"}'
```

### 3. 测试 Vercel 主服务

```bash
# 测试主服务API（应该转发到本地AI服务）
curl -X POST https://ai.zalem.app/api/ai/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "测试", "locale": "zh-CN"}'
```

### 4. 检查响应头

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

## 🔧 服务选择优先级

主站路由 `/api/ai/ask` 的服务选择优先级：

1. **URL参数** (`?ai=local` 或 `?ai=online`) - 最高优先级
2. **数据库配置** (`ai_config.aiProvider`) - 中等优先级
3. **环境变量** (`USE_LOCAL_AI`) - 默认优先级

## 🚨 故障排查

### 问题1：DNS解析失败

**症状**：`nslookup ai-service.zalem.app` 无法解析

**解决**：
1. 等待DNS记录生效（通常几分钟到几小时）
2. 检查Cloudflare Dashboard中的DNS记录
3. 确认记录类型为CNAME，值为 `4ee594fd-910d-4a89-9c34-79ca705493e0.cfargotunnel.com`

### 问题2：Cloudflare Tunnel未运行

**检查**：
```bash
ps aux | grep cloudflared
cloudflared tunnel info local-ai-service
```

**解决**：
```bash
# 重启隧道
cloudflared tunnel run local-ai-service
```

### 问题3：本地AI服务未运行

**检查**：
```bash
lsof -i :8788
curl http://127.0.0.1:8788/healthz
```

**解决**：
```bash
cd apps/local-ai-service
pnpm dev
```

### 问题4：Vercel无法访问本地AI服务

**原因**：Vercel环境变量未配置或配置错误

**解决**：
1. 在Vercel Dashboard中检查环境变量
2. 确认 `LOCAL_AI_SERVICE_URL=https://ai-service.zalem.app`
3. 确认 `USE_LOCAL_AI=true`
4. 重新部署（环境变量更改后可能需要重新部署）

## 📊 监控和维护

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

## 📋 配置清单

- [x] Cloudflare Tunnel配置文件已更新
- [x] DNS路由已配置（ai-service.zalem.app）
- [x] 隧道已启动并运行
- [ ] Vercel环境变量已配置（需要在Vercel Dashboard中配置）
- [ ] DNS记录已生效（等待几分钟）
- [ ] 测试验证通过

## 🎯 下一步操作

1. **在Vercel Dashboard中配置环境变量**
   - 登录 Vercel Dashboard
   - 进入 Settings > Environment Variables
   - 添加上述环境变量

2. **等待DNS生效**
   - 通常需要几分钟到几小时
   - 使用 `nslookup ai-service.zalem.app` 检查

3. **测试验证**
   - 测试 Cloudflare Tunnel：`curl https://ai-service.zalem.app/healthz`
   - 测试 Vercel 主服务：`curl -X POST https://ai.zalem.app/api/ai/ask ...`

4. **监控服务状态**
   - 定期检查服务状态
   - 查看日志文件

## 💡 重要提示

1. **DNS生效时间**：DNS记录可能需要几分钟到几小时才能生效，请耐心等待
2. **环境变量**：Vercel环境变量更改后可能需要重新部署才能生效
3. **服务优先级**：可以通过URL参数 `?ai=local` 或 `?ai=online` 强制选择服务
4. **数据库配置**：可以在AI配置中心设置 `aiProvider` 来切换服务
5. **备用服务**：建议同时配置在线AI服务作为备用

