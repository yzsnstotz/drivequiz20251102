# Vercel 日志查看指南

## 重要提示

⚠️ **这些日志是运行时日志，不是构建日志！**

- ❌ **Build Logs** - 这些是构建时的日志，不会包含运行时日志
- ✅ **Function Logs / Runtime Logs** - 这些是 API 被调用时的日志

## 查看日志的步骤

### 方法 1：通过 Deployments 页面（推荐）

1. 登录 [Vercel Dashboard](https://vercel.com/dashboard)
2. 选择项目：`drivequiz20251102-app`
3. 进入 **Deployments** 页面
4. 找到最新的 Preview 部署（应该是最新的提交）
5. 点击部署卡片进入详情页
6. 在顶部标签页中找到 **"Logs"** 或 **"Function Logs"**
7. 或者点击 **"Functions"** 标签页，然后选择 `api/ai/ask` 函数

### 方法 2：通过项目设置

1. 登录 Vercel Dashboard
2. 选择项目
3. 进入 **Settings** > **Logs**
4. 这里可以看到所有函数的日志

### 方法 3：使用 Vercel CLI（本地查看）

```bash
# 安装 Vercel CLI（如果还没有）
npm i -g vercel

# 登录
vercel login

# 查看日志（实时）
vercel logs --follow

# 查看特定函数的日志
vercel logs --follow --function api/ai/ask
```

## 如何触发日志输出

**重要：日志只在 API 被调用时才会出现！**

### 步骤 1：触发 API 请求

使用以下命令触发 API 请求：

```bash
# 设置 cookie（如果需要）
curl -c /tmp/vercel_cookies.txt "https://drivequiz20251102-app-git-localaimodule-zalems-projects.vercel.app/api/ai/ask?ai=local&x-vercel-set-bypass-cookie=true&x-vercel-protection-bypass=dgo9MHSPwyVg85bb2dcCab2HuUJ0Wuws" > /dev/null 2>&1

# 触发 API 请求
curl -b /tmp/vercel_cookies.txt -X POST "https://drivequiz20251102-app-git-localaimodule-zalems-projects.vercel.app/api/ai/ask?ai=local" \
  -H "Content-Type: application/json" \
  -d '{"question":"测试日志","locale":"zh"}'
```

### 步骤 2：立即查看日志

触发请求后，立即在 Vercel Dashboard 中查看日志：

1. 进入 Deployments 页面
2. 选择最新的部署
3. 点击 **"Logs"** 标签页
4. 日志应该会实时出现（可能需要刷新）

## 日志关键词搜索

在 Vercel 日志中搜索以下关键词：

### 1. 模块加载日志
```
[ENV MODULE]
```
- 显示模块加载时的环境变量配置
- 应该出现在函数首次加载时

### 2. 请求开始日志
```
[POST START]
```
- 显示每次请求开始时的环境变量
- 包含 `USE_LOCAL_AI`、`LOCAL_AI_SERVICE_URL` 等

### 3. AI 服务选择日志
```
[PICK AI TARGET]
```
- 显示 AI 服务选择的详细过程
- 包括选择逻辑、最终选择结果

### 4. URL 参数检查日志
```
[FORCE MODE]
```
- 显示 URL 参数 `?ai=local` 的解析结果

### 5. 步骤日志
```
[STEP 3]
```
- 显示 AI 服务选择步骤的详细信息

## 常见问题

### Q1: 为什么看不到日志？

**A**: 可能的原因：
1. **还没有触发 API 请求** - 日志只在 API 被调用时才会出现
2. **查看的是 Build Logs** - 应该查看 Function Logs / Runtime Logs
3. **日志被过滤了** - 检查日志过滤设置
4. **部署还没有完成** - 等待部署完成后再触发请求

### Q2: 日志在哪里？

**A**: 
- ✅ **Deployments** > 选择部署 > **Logs** 标签页
- ✅ **Deployments** > 选择部署 > **Functions** > 选择函数 > 查看日志
- ✅ **Settings** > **Logs**

### Q3: 如何实时查看日志？

**A**: 
- 使用 Vercel CLI: `vercel logs --follow`
- 在 Dashboard 中刷新日志页面
- 触发请求后立即查看

### Q4: 日志太多，如何过滤？

**A**: 在 Vercel Dashboard 的日志页面：
- 使用搜索框搜索关键词（如 `[PICK AI TARGET]`）
- 使用时间过滤器
- 使用函数过滤器

## 调试技巧

### 1. 触发请求后立即查看

1. 在一个终端触发 API 请求
2. 立即切换到 Vercel Dashboard 查看日志
3. 日志应该会在几秒内出现

### 2. 使用 Vercel CLI 实时查看

```bash
# 在一个终端运行
vercel logs --follow --function api/ai/ask

# 在另一个终端触发请求
curl -b /tmp/vercel_cookies.txt -X POST "https://drivequiz20251102-app-git-localaimodule-zalems-projects.vercel.app/api/ai/ask?ai=local" \
  -H "Content-Type: application/json" \
  -d '{"question":"测试","locale":"zh"}'
```

### 3. 检查日志时间戳

确保查看的是最新部署的日志，检查日志时间戳是否匹配。

## 下一步

查看日志后，根据日志内容：
1. 检查 `[ENV MODULE]` 中的环境变量值
2. 检查 `[POST START]` 中的运行时环境变量
3. 检查 `[PICK AI TARGET]` 中的选择逻辑
4. 找出为什么 `USE_LOCAL_AI=true` 但没有使用本地 AI 服务

