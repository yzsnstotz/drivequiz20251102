# 修复空请求体错误

## 问题描述

AI Service 返回 400 错误：
```
FastifyError: Body cannot be empty when content-type is set to 'application/json'
```

## 原因分析

Fastify 框架要求：
- 如果请求头设置了 `Content-Type: application/json`
- 则必须提供 JSON 格式的请求体
- 即使不需要数据，也要发送空对象 `{}`

我们的代码在发送 POST 请求时：
- ✅ 设置了 `Content-Type: application/json`
- ❌ 但没有发送请求体（body）

## 修复内容

### 修复前
```typescript
resp = await fetch(url, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${AI_SERVICE_TOKEN}`,
  },
  cache: "no-store",
  signal: controller.signal,
});
```

### 修复后
```typescript
resp = await fetch(url, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${AI_SERVICE_TOKEN}`,
  },
  // 发送空的 JSON body（Fastify 要求如果设置了 Content-Type: application/json，必须有 body）
  body: JSON.stringify({}),
  cache: "no-store",
  signal: controller.signal,
});
```

## 修复的文件

1. ✅ `src/app/api/admin/ai/summary/rebuild/route.ts`
2. ✅ `src/app/api/admin/ai/cache/prewarm/route.ts`

## 验证

修复后，请求应该：
- ✅ 包含空的 JSON body `{}`
- ✅ 满足 Fastify 的要求
- ✅ 不再返回 400 错误

## 相关日志

从 AI Service 日志可以看到：
- `POST /v1/admin/cache/prewarm` - 之前返回 400
- `POST /v1/admin/daily-summary/rebuild` - 之前返回 400

修复后应该返回 200 或相应的业务状态码。

