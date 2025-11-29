# NEXT_PUBLIC_APP_BASE_URL 配置说明

## 📋 概述

`NEXT_PUBLIC_APP_BASE_URL` 用于在**服务端渲染（SSR）**时获取应用的基础 URL，主要用于管理后台页面进行 API 调用。

---

## 🔍 作用

### 主要用途

1. **服务端渲染（SSR）时获取基础 URL**
   - 在服务端，没有 `window` 对象，无法使用 `window.location.origin`
   - 需要环境变量来获取应用的基础 URL

2. **管理后台页面 API 调用**
   - 用于构建完整的 API 请求 URL
   - 例如：`${base}/api/admin/ai/config`

3. **内部服务调用**
   - 后台接口调用主站接口时，需要知道主站 URL

---

## 📊 使用场景

### 场景 1: 管理后台页面（Admin Pages）

**文件**: `src/app/admin/ai/config/page.tsx`

```typescript
function getBaseUrl(): string {
  if (typeof window !== "undefined") {
    // 客户端：使用 window.location.origin
    return window.location.origin;
  }
  // 服务端：使用环境变量
  return process.env.NEXT_PUBLIC_APP_BASE_URL ?? "";
}

async function fetchConfig(): Promise<ConfigResp> {
  const base = getBaseUrl();
  const res = await fetch(`${base}/api/admin/ai/config`, {
    cache: "no-store",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return res.json();
}
```

**使用位置**:
- `src/app/admin/ai/config/page.tsx` - AI 配置页面
- `src/app/admin/ai/scenes/page.tsx` - 场景配置页面
- `src/app/admin/ai/monitor/page.tsx` - 监控页面
- `src/app/admin/ai/filters/page.tsx` - 过滤器页面
- `src/app/admin/ai/rag/page.tsx` - RAG 页面
- `src/app/admin/ai/rag/list/page.tsx` - RAG 列表页面

### 场景 2: 后台接口内部调用

**文件**: `src/app/api/admin/ai/ask/route.ts`

```typescript
async function callMainAiAsk(...) {
  // 在 Vercel 环境中，使用绝对 URL
  let baseUrl = process.env.VERCEL_URL || process.env.NEXT_PUBLIC_APP_URL;
  
  if (baseUrl) {
    if (!baseUrl.startsWith("http")) {
      baseUrl = `https://${baseUrl}`;
    }
  } else {
    baseUrl = "http://localhost:3000"; // 默认值
  }
  
  const apiUrl = `${baseUrl}/api/ai/ask`;
  // ...
}
```

**注意**: 这里使用的是 `NEXT_PUBLIC_APP_URL`，不是 `NEXT_PUBLIC_APP_BASE_URL`。

---

## ✅ 是否必需？

### 本地开发环境

**答案**: **不是必需的** ✅

**原因**:
1. **客户端优先使用 `window.location.origin`**
   - 在浏览器中，代码会优先使用 `window.location.origin`
   - 只有在服务端渲染时才需要环境变量

2. **有默认值处理**
   - 代码中有 `?? ""` 处理，如果未设置，会使用空字符串
   - 在客户端，会回退到 `window.location.origin`

3. **本地开发通常使用客户端渲染**
   - 大多数情况下，管理后台页面在客户端运行
   - 只有在首次加载时才会进行服务端渲染

### 生产环境（Vercel）

**答案**: **建议设置** ⚠️

**原因**:
1. **服务端渲染需要**
   - Vercel 会进行服务端渲染（SSR）
   - 需要环境变量来构建完整的 URL

2. **SEO 和性能**
   - 服务端渲染有助于 SEO 和首屏加载性能

3. **内部服务调用**
   - 后台接口可能需要调用主站接口
   - 需要知道主站的完整 URL

---

## 🔧 如何设置

### 本地开发环境

**可选设置**（如果遇到 SSR 问题）:

```bash
# .env.local
NEXT_PUBLIC_APP_BASE_URL=http://localhost:3000
```

**注意**: 
- 如果使用 `http://localhost:3001`，确保应用确实运行在 3001 端口
- 默认 Next.js 开发服务器运行在 3000 端口

### 生产环境（Vercel）

**建议设置**:

```bash
# Vercel 环境变量
NEXT_PUBLIC_APP_BASE_URL=https://your-domain.com
```

**或者使用 Vercel 自动提供的变量**:
- `VERCEL_URL` - Vercel 自动提供（预览环境）
- `NEXT_PUBLIC_APP_URL` - 可以手动设置（生产环境）

---

## 📊 代码逻辑分析

### 优先级机制

**客户端（浏览器）**:
```typescript
if (typeof window !== "undefined") {
  return window.location.origin; // ✅ 优先使用
}
```

**服务端（SSR）**:
```typescript
return process.env.NEXT_PUBLIC_APP_BASE_URL ?? ""; // 使用环境变量或空字符串
```

### 相关环境变量

代码中使用了多个相关变量：

1. **`NEXT_PUBLIC_APP_BASE_URL`**
   - 主要用于管理后台页面
   - 服务端渲染时获取基础 URL

2. **`NEXT_PUBLIC_APP_URL`**
   - 用于后台接口内部调用
   - 优先级：`VERCEL_URL` > `NEXT_PUBLIC_APP_URL` > `http://localhost:3000`

3. **`VERCEL_URL`**
   - Vercel 自动提供
   - 仅在 Vercel 环境中可用

---

## 🎯 当前配置分析

### 您提供的配置

```bash
NEXT_PUBLIC_APP_BASE_URL=http://localhost:3001
```

### 分析

1. **端口不匹配**
   - 默认 Next.js 开发服务器运行在 **3000** 端口
   - 您设置的是 **3001** 端口
   - 如果应用确实运行在 3001 端口，这个配置是正确的

2. **是否必需**
   - **本地开发**: 不是必需的（客户端会使用 `window.location.origin`）
   - **如果遇到 SSR 问题**: 可以设置，但应该使用正确的端口

3. **建议**
   - 如果应用运行在 3000 端口，应该设置为 `http://localhost:3000`
   - 如果应用运行在 3001 端口，保持 `http://localhost:3001` 是正确的

---

## ✅ 验证方法

### 检查当前端口

```bash
# 查看开发服务器运行的端口
npm run dev
# 通常输出: "Ready on http://localhost:3000"
```

### 测试 SSR 是否正常工作

1. **访问管理后台页面**
   ```bash
   # 例如：http://localhost:3000/admin/ai/config
   ```

2. **查看网络请求**
   - 打开浏览器开发者工具
   - 查看 Network 标签
   - 检查 API 请求的 URL 是否正确

3. **检查控制台日志**
   - 如果 SSR 时 URL 构建错误，会在控制台显示错误

---

## 📌 总结

### 是否必需？

| 环境 | 是否必需 | 说明 |
|------|---------|------|
| **本地开发** | ❌ 不是必需 | 客户端优先使用 `window.location.origin` |
| **Vercel 预览** | ⚠️ 建议设置 | 服务端渲染需要 |
| **Vercel 生产** | ⚠️ 建议设置 | 服务端渲染和 SEO 需要 |

### 当前配置建议

**如果应用运行在 3000 端口**:
```bash
# 可以删除或修改为
NEXT_PUBLIC_APP_BASE_URL=http://localhost:3000
```

**如果应用运行在 3001 端口**:
```bash
# 保持当前配置
NEXT_PUBLIC_APP_BASE_URL=http://localhost:3001
```

### 最佳实践

1. **本地开发**: 可以不设置，让客户端自动使用 `window.location.origin`
2. **生产环境**: 建议设置，确保 SSR 正常工作
3. **端口匹配**: 确保环境变量中的端口与实际运行端口一致

---

## 🔍 相关文件

- `src/app/admin/ai/config/page.tsx` - AI 配置页面
- `src/app/admin/ai/scenes/page.tsx` - 场景配置页面
- `src/app/admin/ai/monitor/page.tsx` - 监控页面
- `src/app/admin/ai/filters/page.tsx` - 过滤器页面
- `src/app/admin/ai/rag/page.tsx` - RAG 页面
- `src/app/api/admin/ai/ask/route.ts` - 后台 AI 接口

