# 配置检查清单

## DNS配置检查

### ✅ 已配置的DNS记录

```
类型: CNAME
名称: ai-service
目标: 4ee594fd-910d-4a89-9c34-79ca705493e0.cfargotunnel.com
TTL: 3600
```

**检查点：**
- ✅ DNS记录类型正确（CNAME）
- ✅ 目标地址正确（Cloudflare Tunnel地址）
- ⚠️ **需要确认**：DNS记录的完整域名应该是 `ai-service.zalem.app`
- ⚠️ **需要确认**：DNS记录的代理状态应该是"已代理"（橙色云朵）

**验证命令：**
```bash
# 测试DNS解析
nslookup ai-service.zalem.app
dig ai-service.zalem.app

# 应该返回：
# ai-service.zalem.app -> 4ee594fd-910d-4a89-9c34-79ca705493e0.cfargotunnel.com
```

## Vercel环境变量检查

### ✅ 已配置的环境变量

```
LOCAL_AI_SERVICE_URL = https://ai-service.zalem.app
```

### ⚠️ 需要确认的环境变量

根据代码要求，以下环境变量**必须配置**：

#### 1. 本地AI服务配置（必需）

```bash
# 启用本地AI服务
USE_LOCAL_AI=true

# Cloudflare Tunnel的公共URL
LOCAL_AI_SERVICE_URL=https://ai-service.zalem.app  ✅ 已配置

# 本地AI服务的认证令牌（必需）
LOCAL_AI_SERVICE_TOKEN=<your-token>  ⚠️ 需要确认
```

#### 2. 备用在线AI服务配置（推荐，用于回退）

```bash
# 备用在线AI服务URL（如果本地服务不可用）
AI_SERVICE_URL=https://zalem.onrender.com  ⚠️ 需要确认

# 备用在线AI服务的认证令牌
AI_SERVICE_TOKEN=<your-token>  ⚠️ 需要确认
```

#### 3. 其他可能需要的环境变量

```bash
# 用户JWT密钥（如果使用JWT验证）
USER_JWT_SECRET=<your-secret>  ⚠️ 需要确认（如果使用）
```

## Cloudflare Tunnel配置检查

### ⚠️ 需要确认的配置

#### 1. Tunnel配置文件

检查 `~/.cloudflared/config.yml`：

```yaml
tunnel: 4ee594fd-910d-4a89-9c34-79ca705493e0
credentials-file: /Users/leoventory/.cloudflared/4ee594fd-910d-4a89-9c34-79ca705493e0.json

ingress:
  - hostname: ai-service.zalem.app
    service: http://localhost:8788
  - service: http_status:404
```

**检查点：**
- ✅ Tunnel ID正确
- ✅ hostname配置为 `ai-service.zalem.app`
- ✅ service指向本地服务端口 `8788`
- ⚠️ **需要确认**：credentials-file文件是否存在

#### 2. Tunnel运行状态

**检查命令：**
```bash
# 检查Tunnel是否运行
cloudflared tunnel list

# 检查Tunnel状态
cloudflared tunnel info local-ai-service

# 启动Tunnel（如果未运行）
cloudflared tunnel run local-ai-service
```

#### 3. DNS路由配置

**检查命令：**
```bash
# 检查DNS路由
cloudflared tunnel route dns list

# 应该看到：
# ai-service.zalem.app -> 4ee594fd-910d-4a89-9c34-79ca705493e0
```

## 配置完整性检查清单

### DNS配置
- [x] DNS记录类型：CNAME
- [x] DNS记录名称：ai-service
- [x] DNS记录目标：4ee594fd-910d-4a89-9c34-79ca705493e0.cfargotunnel.com
- [ ] DNS记录完整域名：`ai-service.zalem.app`（需要验证）
- [ ] DNS记录代理状态：已代理（橙色云朵）（需要确认）
- [ ] DNS解析测试通过（需要测试）

### Vercel环境变量
- [x] LOCAL_AI_SERVICE_URL = https://ai-service.zalem.app
- [ ] USE_LOCAL_AI = true（需要确认）
- [ ] LOCAL_AI_SERVICE_TOKEN = <token>（需要确认）
- [ ] AI_SERVICE_URL = https://zalem.onrender.com（需要确认，用于回退）
- [ ] AI_SERVICE_TOKEN = <token>（需要确认，用于回退）

### Cloudflare Tunnel
- [ ] Tunnel配置文件存在（需要确认）
- [ ] Tunnel正在运行（需要确认）
- [ ] Tunnel hostname配置正确（需要确认）
- [ ] Tunnel service端口正确（8788）（需要确认）
- [ ] DNS路由已配置（需要确认）

### 本地AI服务
- [ ] 本地AI服务正在运行（端口8788）（需要确认）
- [ ] 本地AI服务健康检查通过（需要测试）

## 验证步骤

### 1. 测试DNS解析

```bash
# 测试DNS解析
nslookup ai-service.zalem.app
dig ai-service.zalem.app

# 应该返回CNAME记录指向Cloudflare Tunnel
```

### 2. 测试Cloudflare Tunnel

```bash
# 测试Tunnel连接
curl https://ai-service.zalem.app/health

# 或测试主端点
curl https://ai-service.zalem.app/v1/ask \
  -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <LOCAL_AI_SERVICE_TOKEN>" \
  -d '{"question":"test","userId":"test"}'
```

### 3. 测试Vercel环境变量

在Vercel Dashboard中检查：
- Settings > Environment Variables
- 确认所有必需的环境变量都已配置
- 确认环境变量应用到正确的环境（Production/Preview）

## 常见问题

### 问题1：DNS解析失败

**症状：** `fetch failed` 错误，快速失败（<1秒）

**可能原因：**
1. DNS记录未正确配置
2. DNS记录代理状态未启用
3. DNS记录TTL过长，需要等待生效

**解决方案：**
1. 检查DNS记录配置
2. 确保代理状态为"已代理"（橙色云朵）
3. 等待DNS生效（通常几分钟）

### 问题2：Tunnel未运行

**症状：** DNS解析成功，但连接失败

**解决方案：**
```bash
# 启动Tunnel
cloudflared tunnel run local-ai-service

# 或作为服务运行
sudo cloudflared service install
sudo cloudflared service start
```

### 问题3：环境变量未配置

**症状：** 代码中环境变量为空

**解决方案：**
1. 在Vercel Dashboard中配置所有必需的环境变量
2. 确保环境变量应用到正确的环境
3. 重新部署应用

## 下一步

1. ✅ DNS配置已确认（需要验证完整域名和代理状态）
2. ⚠️ 确认所有Vercel环境变量已配置
3. ⚠️ 确认Cloudflare Tunnel正在运行
4. ⚠️ 测试DNS解析和Tunnel连接
5. ⚠️ 验证本地AI服务正在运行


