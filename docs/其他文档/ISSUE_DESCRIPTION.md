# 问题描述：Cloudflare Tunnel DNS 解析失败

## 问题现象

在生产环境中，Vercel 主服务（`ai.zalem.app`）无法连接到本地 AI 服务（通过 Cloudflare Tunnel 暴露的 `ai-service.zalem.app`），错误信息为：

```
fetch failed
errorType: NETWORK_ERROR
duration: ~72ms
hostname: ai-service.zalem.app
port: 443
protocol: https:
```

**关键特征：**
- 错误发生在 72ms 内（快速失败，通常表示 DNS 解析失败）
- 错误类型：`NETWORK_ERROR`（网络错误）
- DNS 解析返回 `NXDOMAIN`（域名不存在）

## 已确认的配置

### 1. Cloudflare Tunnel 配置 ✅

**配置文件位置：** `~/.cloudflared/config.yml`

```yaml
tunnel: 4ee594fd-910d-4a89-9c34-79ca705493e0
credentials-file: /Users/leoventory/.cloudflared/4ee594fd-910d-4a89-9c34-79ca705493e0.json

ingress:
  - hostname: ai-service.zalem.app
    service: http://localhost:8788
  - service: http_status:404
```

**Tunnel 状态：**
- ✅ Tunnel ID: `4ee594fd-910d-4a89-9c34-79ca705493e0`
- ✅ Tunnel 名称: `local-ai-service`
- ✅ Tunnel 正在运行（进程ID: 30548）
- ✅ 已连接到 Cloudflare 边缘节点（nrt05, nrt07, nrt10, nrt14）
- ✅ 有 4 个活跃连接

**DNS 路由配置：**
- ✅ 已通过 `cloudflared tunnel route dns` 配置
- ✅ 系统提示：`ai-service.zalem.app is already configured to route to your tunnel`

### 2. DNS 记录配置（用户提供）✅

```
类型: CNAME
名称: ai-service
目标: 4ee594fd-910d-4a89-9c34-79ca705493e0.cfargotunnel.com
TTL: 3600
```

### 3. Vercel 环境变量 ✅

```
LOCAL_AI_SERVICE_URL = https://ai-service.zalem.app
```

## 问题诊断

### DNS 解析测试结果

```bash
$ nslookup ai-service.zalem.app
Server:		100.100.100.100
Address:	100.100.100.100#53

** server can't find ai-service.zalem.app: NXDOMAIN
```

**结果：** DNS 解析失败，返回 `NXDOMAIN`（域名不存在）

### 连接测试结果

```bash
$ curl https://ai-service.zalem.app/health
连接失败
```

**结果：** 无法连接到服务

## 可能的原因

### 1. DNS 记录配置问题（最可能）

**可能的问题：**
- DNS 记录在 Cloudflare Dashboard 中未正确保存
- DNS 记录名称错误（应该是 `ai-service`，不是 `ai-service.zalem.app`）
- DNS 记录代理状态未启用（应该是"已代理"橙色云朵，不是"仅 DNS"灰色云朵）
- DNS 记录目标地址错误

**需要检查：**
1. 登录 Cloudflare Dashboard
2. 选择域名 `zalem.app`
3. 进入 DNS > Records
4. 查找 CNAME 记录：
   - 名称：`ai-service`
   - 目标：`4ee594fd-910d-4a89-9c34-79ca705493e0.cfargotunnel.com`
   - 代理状态：**必须启用代理**（橙色云朵）
   - TTL：自动（如果启用代理）

### 2. DNS 传播延迟

**可能的问题：**
- DNS 记录刚配置，需要等待传播（TTL 为 3600 秒，约 1 小时）
- 不同 DNS 服务器缓存不同步

**解决方案：**
- 等待 DNS 传播（通常几分钟到几小时）
- 清除本地 DNS 缓存
- 使用不同的 DNS 服务器测试

### 3. Cloudflare Tunnel 配置问题

**可能的问题：**
- Tunnel 配置中的 hostname 与 DNS 记录不匹配
- Tunnel 未正确连接到 Cloudflare 边缘

**已确认：**
- ✅ Tunnel 配置文件中的 hostname 正确：`ai-service.zalem.app`
- ✅ Tunnel 已连接到 Cloudflare 边缘节点
- ✅ DNS 路由已配置

### 4. 域名管理问题

**可能的问题：**
- 域名 `zalem.app` 未在 Cloudflare 中正确管理
- DNS 服务器未指向 Cloudflare

**需要检查：**
- 域名 `zalem.app` 是否在 Cloudflare 账户中
- 域名的 DNS 服务器是否指向 Cloudflare（通常是 `*.ns.cloudflare.com`）

## 需要专家检查的点

### 1. Cloudflare Dashboard 检查

请检查以下内容：

1. **DNS 记录是否存在：**
   - 登录 Cloudflare Dashboard
   - 选择域名 `zalem.app`
   - 进入 DNS > Records
   - 查找 CNAME 记录：`ai-service`

2. **DNS 记录配置是否正确：**
   - 名称：`ai-service`（不是 `ai-service.zalem.app`）
   - 目标：`4ee594fd-910d-4a89-9c34-79ca705493e0.cfargotunnel.com`
   - 代理状态：**必须启用代理**（橙色云朵）
   - TTL：自动（如果启用代理）

3. **域名管理状态：**
   - 域名 `zalem.app` 是否在 Cloudflare 账户中
   - 域名的 DNS 服务器是否指向 Cloudflare

### 2. DNS 解析测试

请在不同位置测试 DNS 解析：

```bash
# 使用 nslookup
nslookup ai-service.zalem.app

# 使用 dig
dig ai-service.zalem.app

# 使用 Cloudflare DNS
dig @1.1.1.1 ai-service.zalem.app

# 使用 Google DNS
dig @8.8.8.8 ai-service.zalem.app
```

### 3. Cloudflare Tunnel 状态

请检查 Tunnel 连接状态：

```bash
# 检查 Tunnel 列表
cloudflared tunnel list

# 检查 Tunnel 信息
cloudflared tunnel info local-ai-service

# 检查 Tunnel 日志
tail -f /tmp/cloudflared.log
```

### 4. 网络连接测试

请测试从不同位置连接到服务：

```bash
# 测试健康检查端点
curl https://ai-service.zalem.app/health

# 测试主端点
curl https://ai-service.zalem.app/v1/ask \
  -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"question":"test"}'
```

## 当前状态总结

### ✅ 已确认正常的部分

1. Cloudflare Tunnel 配置文件正确
2. Cloudflare Tunnel 正在运行并连接到边缘节点
3. DNS 路由已通过 `cloudflared tunnel route dns` 配置
4. 本地 AI 服务正在运行（端口 8788）
5. Vercel 环境变量已配置

### ❌ 问题所在

1. **DNS 解析失败**（`NXDOMAIN`）
   - 这是核心问题
   - 可能原因：DNS 记录未正确配置或代理状态未启用

2. **无法连接到服务**
   - 由于 DNS 解析失败，无法建立连接

## 建议的解决步骤

1. **立即检查 Cloudflare Dashboard：**
   - 确认 DNS 记录存在且配置正确
   - 确认代理状态已启用（橙色云朵）

2. **如果 DNS 记录不存在或配置错误：**
   - 创建或修改 CNAME 记录
   - 名称：`ai-service`
   - 目标：`4ee594fd-910d-4a89-9c34-79ca705493e0.cfargotunnel.com`
   - 启用代理（橙色云朵）

3. **等待 DNS 传播：**
   - 通常需要几分钟到几小时
   - 可以清除本地 DNS 缓存加速

4. **验证 DNS 解析：**
   - 使用 `nslookup` 或 `dig` 测试
   - 应该返回 Cloudflare 的 IP 地址（如果启用代理）

5. **测试连接：**
   - 测试健康检查端点
   - 测试主端点

## 相关文件

- Tunnel 配置文件：`~/.cloudflared/config.yml`
- Tunnel 日志：`/tmp/cloudflared.log`
- 配置检查清单：`CONFIGURATION_CHECKLIST.md`

## 联系方式

如有需要，可以提供：
- Cloudflare Dashboard 截图
- DNS 记录配置截图
- Tunnel 日志文件
- 网络测试结果


