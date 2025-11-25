# 修复缓存预热 404 错误

## 问题描述

AI Service 返回 404 错误：
```
Route POST:/v1/admin/cache/prewarm not found
```

## 原因分析

### 问题根源
AI Service 生产环境（Render）中可能：
1. **路由未部署**：`/v1/admin/cache/prewarm` 路由在生产环境中不存在
2. **路由注册失败**：路由注册时出错，但被 try-catch 静默忽略
3. **代码版本不一致**：生产环境使用的是旧版本代码，不包含此路由

### 代码状态
- ✅ Next.js 应用中的路由代码已修复（添加了 body）
- ✅ AI Service 代码中存在路由定义（`apps/ai-service/src/routes/admin/cache-prewarm.ts`）
- ❌ AI Service 生产环境可能未包含此路由

## 修复内容

### 1. 改进错误处理

在 `src/app/api/admin/ai/cache/prewarm/route.ts` 中添加了 404 错误的特殊处理：

```typescript
if (!resp.ok) {
  // 404 错误说明路由不存在，可能是 AI Service 版本问题
  if (resp.status === 404) {
    return providerError("AI Service route not found", {
      status: resp.status,
      statusText: resp.statusText,
      url: prewarmUrl,
      message: "缓存预热路由在 AI Service 中不存在。请检查 AI Service 是否已部署最新版本，或联系运维人员更新服务。",
      suggestion: "请确认 AI Service 已包含 cache-prewarm 路由，或等待服务更新后重试",
    });
  }
  // ... 其他错误处理
}
```

### 2. 错误消息改进

现在会返回更清晰的错误信息：
- 明确说明是路由不存在的问题
- 提供解决方案建议
- 包含中文错误消息

## 解决方案

### 方案 1：更新 AI Service（推荐）

确保 AI Service 生产环境包含 `cache-prewarm` 路由：

1. **检查 AI Service 代码**：
   - 确认 `apps/ai-service/src/routes/admin/cache-prewarm.ts` 存在
   - 确认 `apps/ai-service/src/index.ts` 中注册了路由

2. **重新部署 AI Service**：
   - 在 Render 或其他部署平台重新部署
   - 确保部署包含了最新的路由代码

3. **验证路由注册**：
   - 检查 AI Service 启动日志，确认路由已注册
   - 查找日志中的 "Registered /v1/admin/cache/prewarm route" 消息

### 方案 2：临时禁用功能（临时方案）

如果暂时无法更新 AI Service，可以：
1. 在前端禁用缓存预热按钮
2. 显示友好的提示信息："此功能暂时不可用"

## 验证步骤

1. **检查 AI Service 日志**：
   ```bash
   # 在 Render 或其他平台查看 AI Service 日志
   # 查找 "Registered /v1/admin/cache/prewarm route" 消息
   ```

2. **测试路由**：
   ```bash
   curl -X POST "https://zalem.onrender.com/v1/admin/cache/prewarm" \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -d '{}'
   ```

3. **检查错误响应**：
   - 现在应该返回更清晰的错误消息
   - 包含中文说明和解决建议

## 修复的文件

1. ✅ `src/app/api/admin/ai/cache/prewarm/route.ts` - 添加 404 错误特殊处理

## 下一步

1. **联系运维**：确认 AI Service 是否需要重新部署
2. **检查部署**：确认生产环境代码是否包含最新路由
3. **验证功能**：更新后验证缓存预热功能是否正常

