# Cloudflare 免费域名配置指南

## 使用 Cloudflare 免费域名的简单方法

如果你**没有自己的域名**，或者**不想选择 zone**，可以使用 Cloudflare 提供的临时免费域名。

### 方法：直接创建临时隧道（最简单）

**不需要选择 zone，不需要创建命名隧道！**

## 快速开始

### 步骤 1：确保本地 AI 服务运行

```bash
cd apps/local-ai-service
pnpm dev
```

### 步骤 2：启动 Cloudflare Tunnel

```bash
# 使用脚本（推荐）
./scripts/start-cloudflare-tunnel-simple.sh

# 或直接运行
cloudflared tunnel --url http://localhost:8788
```

### 步骤 3：获取公共 URL

启动后会显示类似以下信息：

```
+--------------------------------------------------------------------------------------------+
|  Your quick Tunnel has been created! Visit it at (it may take some time to be reachable):  |
|  https://xxxx-xxxx-xxxx.trycloudflare.com                                                 |
|+--------------------------------------------------------------------------------------------+
```

**这个 URL 就是你的公共访问地址！**

### 步骤 4：在 Vercel 中配置

在 Vercel Dashboard > Settings > Environment Variables 中添加：

```bash
USE_LOCAL_AI=true
LOCAL_AI_SERVICE_URL=https://xxxx-xxxx-xxxx.trycloudflare.com
LOCAL_AI_SERVICE_TOKEN=local_ai_token_dev_12345
```

### 步骤 5：验证配置

```bash
# 测试健康检查
curl https://xxxx-xxxx-xxxx.trycloudflare.com/healthz

# 测试 API
curl -X POST https://xxxx-xxxx-xxxx.trycloudflare.com/v1/ask \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer local_ai_token_dev_12345" \
  -d '{"question": "测试", "lang": "zh"}'
```

## 关于 Cloudflare 授权界面

如果你看到了 "Authorize Cloudflare Tunnel" 界面，要求选择 zone：

### 选项 1：关闭浏览器，使用临时隧道（推荐）

**直接关闭浏览器窗口**，然后使用上面的简单方法：

```bash
cloudflared tunnel --url http://localhost:8788
```

这样**不需要选择 zone**，会自动创建临时隧道。

### 选项 2：选择任意 zone（如果有）

如果你在 Cloudflare 中有域名，可以选择任意一个，但这不影响使用免费域名。

## 注意事项

### ⚠️ 临时 URL 的特点

1. **每次启动都会变化**：每次运行 `cloudflared tunnel --url` 都会生成新的 URL
2. **需要保持运行**：关闭终端或停止命令，URL 就会失效
3. **适合开发测试**：不适合生产环境长期使用

### ✅ 生产环境建议

如果需要稳定的 URL，建议：
1. 使用自己的域名（在 Cloudflare 管理）
2. 创建命名隧道（使用 `cloudflared tunnel create`）
3. 配置 DNS 记录

## 完整示例

```bash
# 1. 启动本地 AI 服务（新终端）
cd apps/local-ai-service
pnpm dev

# 2. 启动 Cloudflare Tunnel（另一个终端）
./scripts/start-cloudflare-tunnel-simple.sh

# 3. 复制显示的 URL（如：https://xxxx-xxxx-xxxx.trycloudflare.com）

# 4. 在 Vercel Dashboard 中配置环境变量
# USE_LOCAL_AI=true
# LOCAL_AI_SERVICE_URL=https://xxxx-xxxx-xxxx.trycloudflare.com
# LOCAL_AI_SERVICE_TOKEN=local_ai_token_dev_12345

# 5. 测试
curl https://xxxx-xxxx-xxxx.trycloudflare.com/healthz
```

## 常见问题

### Q1: 授权界面要求选择 zone，但我没有域名怎么办？

**A**: 直接关闭浏览器，使用 `cloudflared tunnel --url` 命令，不需要选择 zone。

### Q2: URL 每次启动都变化怎么办？

**A**: 这是临时隧道的特性。如果需要稳定 URL，需要：
- 使用自己的域名
- 创建命名隧道
- 配置 DNS 记录

### Q3: 如何让隧道在后台运行？

**A**: 
```bash
# 使用 nohup
nohup cloudflared tunnel --url http://localhost:8788 > /tmp/cloudflared.log 2>&1 &

# 或使用 screen/tmux
screen -S cloudflared
cloudflared tunnel --url http://localhost:8788
# 按 Ctrl+A 然后 D 退出 screen
```

### Q4: 如何停止隧道？

**A**: 
- 如果在前台运行：按 `Ctrl+C`
- 如果在后台运行：找到进程并杀死
  ```bash
  pkill -f "cloudflared tunnel"
  ```

## 总结

- ✅ **最简单方法**：`cloudflared tunnel --url http://localhost:8788`
- ✅ **不需要选择 zone**：直接关闭授权界面
- ✅ **自动生成免费 URL**：格式为 `https://xxxx-xxxx-xxxx.trycloudflare.com`
- ⚠️ **URL 会变化**：每次启动都会生成新的 URL
- ⚠️ **需要保持运行**：关闭终端 URL 就会失效

