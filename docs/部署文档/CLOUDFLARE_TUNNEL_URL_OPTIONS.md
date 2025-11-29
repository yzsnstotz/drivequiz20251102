# Cloudflare Tunnel URL 选项说明

## 两种URL方案对比

### 方案1：使用自定义域名（推荐）

**URL**: `https://ai-service.zalem.app`

#### 优点
- ✅ URL简短，更专业
- ✅ 易于记忆和维护
- ✅ 与主域名一致
- ✅ 更符合生产环境标准

#### 缺点
- ❌ 需要DNS配置
- ❌ 需要等待DNS生效（通常几分钟）

#### 配置步骤
1. 在Cloudflare Dashboard中配置DNS记录：
   - 类型：CNAME
   - 名称：`ai-service`
   - 目标：`4ee594fd-910d-4a89-9c34-79ca705493e0.cfargotunnel.com`
   - 代理状态：已代理（橙色云朵）

2. 在Vercel中配置环境变量：
   ```bash
   USE_LOCAL_AI=true
   LOCAL_AI_SERVICE_URL=https://ai-service.zalem.app
   LOCAL_AI_SERVICE_TOKEN=local_ai_token_dev_12345
   ```

### 方案2：使用临时隧道模式（快速测试）

**URL**: `https://xxxx-xxxx-xxxx.trycloudflare.com`（临时URL，每次启动可能不同）

#### 优点
- ✅ 立即可用，不需要DNS配置
- ✅ 不需要等待DNS生效
- ✅ 适合快速测试

#### 缺点
- ❌ URL每次启动可能变化
- ❌ 不够稳定，不适合生产环境
- ❌ URL较长，不够友好

#### 配置步骤
1. 停止当前命名隧道
2. 使用临时隧道模式：
   ```bash
   cloudflared tunnel --url http://localhost:8788
   ```
3. 获取显示的临时URL（如：`https://xxxx-xxxx-xxxx.trycloudflare.com`）
4. 在Vercel中配置环境变量：
   ```bash
   USE_LOCAL_AI=true
   LOCAL_AI_SERVICE_URL=https://xxxx-xxxx-xxxx.trycloudflare.com
   LOCAL_AI_SERVICE_TOKEN=local_ai_token_dev_12345
   ```

### 方案3：直接使用cfargotunnel.com域名（不推荐）

**URL**: `https://4ee594fd-910d-4a89-9c34-79ca705493e0.cfargotunnel.com`

#### 说明
- 命名隧道通常需要配置hostname才能使用
- 直接使用cfargotunnel.com域名可能无法工作
- 需要修改配置文件，移除hostname限制

#### 如果必须使用，需要修改配置：
```yaml
tunnel: 4ee594fd-910d-4a89-9c34-79ca705493e0
credentials-file: /Users/leoventory/.cloudflared/4ee594fd-910d-4a89-9c34-79ca705493e0.json

ingress:
  - service: http://localhost:8788
```

**注意**：这样配置后，将无法使用自定义域名。

## 推荐方案

### 生产环境
**推荐使用方案1（自定义域名）**
- 更专业
- 更稳定
- 更易于维护

### 开发/测试环境
**可以使用方案2（临时隧道）**
- 快速测试
- 不需要DNS配置

## 当前配置状态

- ✅ 已配置命名隧道：`local-ai-service`
- ✅ 已配置hostname：`ai-service.zalem.app`
- ✅ 隧道运行正常
- ⏳ 等待DNS配置生效

## 建议

1. **立即使用**：如果急需使用，可以先配置DNS，等待几分钟生效
2. **快速测试**：可以使用临时隧道模式快速测试
3. **生产环境**：建议使用自定义域名，更专业稳定


