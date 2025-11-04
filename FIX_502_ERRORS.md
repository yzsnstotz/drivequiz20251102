# 修复 502 Bad Gateway 错误

## 问题描述

两个 API 路由返回 502 错误：
- `POST /api/admin/ai/summary/rebuild`
- `POST /api/admin/ai/cache/prewarm`

## 原因分析

502 Bad Gateway 错误通常表示：
1. **网络连接问题**：无法连接到下游服务（AI Service）
2. **超时问题**：请求超时未得到响应
3. **下游服务错误**：AI Service 返回了错误状态码
4. **错误处理不完善**：原始错误信息未正确传递

## 修复内容

### 1. 改进错误处理

在两个路由文件中添加了：

#### 超时处理
- 使用 `AbortController` 实现 30 秒超时控制
- 兼容所有 Node.js 版本

#### 网络错误捕获
- 捕获连接失败、超时等网络错误
- 提供清晰的错误信息

#### 详细错误日志
- 添加 `console.error` 记录详细错误信息
- 包含 URL、错误类型等信息

### 2. 错误响应改进

**之前**：
```typescript
return providerError("Upstream error", {
  status: resp.status,
  body: payload,
});
```

**现在**：
```typescript
return providerError("AI Service returned an error", {
  status: resp.status,
  statusText: resp.statusText,
  url,
  body: payload,
});
```

### 3. 超时处理示例

```typescript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 30000);

resp = await fetch(url, {
  method: "POST",
  headers: { ... },
  signal: controller.signal,
});

clearTimeout(timeoutId);
```

## 修复的文件

1. ✅ `src/app/api/admin/ai/summary/rebuild/route.ts`
2. ✅ `src/app/api/admin/ai/cache/prewarm/route.ts`

## 测试建议

### 1. 检查 AI Service 状态

```bash
curl -I https://zalem.onrender.com/health
```

### 2. 测试 API 路由

```bash
# 测试摘要重建
curl -X POST "http://localhost:3001/api/admin/ai/summary/rebuild?date=2025-11-03" \
  -H "Authorization: Bearer YOUR_TOKEN"

# 测试缓存预热
curl -X POST "http://localhost:3001/api/admin/ai/cache/prewarm" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 3. 检查环境变量

确保以下环境变量已配置：
```bash
AI_SERVICE_URL=https://zalem.onrender.com
AI_SERVICE_TOKEN=0c2a86471894beb557d858775a3217f6
```

## 可能的问题

### 1. AI Service 未运行
- 检查 Render 服务状态
- 确认服务已启动并运行

### 2. 网络连接问题
- 检查防火墙设置
- 确认网络可以访问 Render 服务

### 3. Token 无效
- 检查 `AI_SERVICE_TOKEN` 是否正确
- 确认 Token 在 AI Service 中已配置

### 4. 路由不存在
- 确认 AI Service 中已实现以下路由：
  - `POST /v1/admin/daily-summary/rebuild`
  - `POST /v1/admin/cache/prewarm`

## 下一步

1. **重启开发服务器**：确保新的错误处理生效
2. **查看服务器日志**：检查详细的错误信息
3. **验证 AI Service**：确认服务正常运行

## 预期行为

修复后，如果遇到问题，应该看到：
- ✅ 更清晰的错误消息（中文）
- ✅ 详细的错误日志（服务器控制台）
- ✅ 准确的错误类型（超时、连接失败等）

