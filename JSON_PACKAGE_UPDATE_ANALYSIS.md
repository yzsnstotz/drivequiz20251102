# JSON包更新机制分析报告

## 当前问题分析

### 1. 前端加载JSON包的机制

**当前实现：**
- 前端使用 `import()` 动态导入 JSON 文件
- 例如：`await import('../data/questions/zh/questions.json')`
- 代码位置：`src/components/QuestionAIDialog.tsx:88`

**问题：**
1. **Next.js 静态资源缓存**：
   - Next.js 在构建时会将 JSON 文件打包到静态资源中
   - 浏览器会缓存这些静态资源
   - 如果 JSON 文件更新了，需要重新构建和部署才能生效

2. **没有版本检查机制**：
   - 前端直接导入 JSON 文件，没有检查版本号
   - 即使后台更新了 JSON 包，前端仍然使用旧的缓存版本

3. **没有缓存破坏策略**：
   - 没有使用 query string 版本号（如 `questions.json?v=1.0.0`）
   - 没有使用文件 hash 作为文件名（如 `questions.abc123.json`）

### 2. 后台更新JSON包的机制

**当前实现：**
- 后台通过 `/api/admin/questions/update-package` 更新 JSON 包
- 更新逻辑：`src/lib/questionDb.ts:updateAllJsonPackages()`
- 更新时会：
  1. 从数据库读取所有题目
  2. 重新计算 hash
  3. 从数据库读取所有 AI 回答
  4. 生成新的版本号
  5. 保存到 `src/data/questions/zh/questions.json`

**问题：**
1. **文件更新后前端不会自动获取**：
   - 后台更新了 `src/data/questions/zh/questions.json` 文件
   - 但前端已经构建的静态资源不会自动更新
   - 需要重新构建和部署前端才能获取新版本

2. **没有版本通知机制**：
   - 前端不知道 JSON 包已经更新
   - 没有 API 来检查最新版本号

### 3. 替换策略

**当前策略：**
- 前端每次打开对话框时加载一次 JSON 包（`useEffect` 中）
- 加载后缓存在组件 state 中（`localAiAnswers`）
- 只在第一次加载时执行（`if (localAiAnswers === null)`）

**问题：**
1. **没有版本检查**：
   - 前端加载的 JSON 包可能是旧版本
   - 没有机制来检测和更新到新版本

2. **缓存策略不完善**：
   - 只在组件级别缓存
   - 没有全局缓存
   - 没有版本号检查

## 解决方案建议

### 方案1：添加版本检查机制（推荐）

**实现步骤：**
1. 前端加载 JSON 包时，先检查版本号
2. 通过 API 获取最新版本号
3. 如果版本不匹配，重新加载 JSON 包

**优点：**
- 可以自动检测新版本
- 不需要重新构建前端

**缺点：**
- 需要额外的 API 调用
- 需要修改前端逻辑

### 方案2：使用动态导入 + 版本号查询参数

**实现步骤：**
1. 前端先获取最新版本号
2. 使用版本号作为查询参数导入 JSON 包
3. 例如：`await import('../data/questions/zh/questions.json?v=1.0.0')`

**优点：**
- 可以强制浏览器重新加载新版本
- 不需要重新构建前端

**缺点：**
- Next.js 可能不支持动态查询参数
- 需要修改构建配置

### 方案3：通过 API 动态加载 JSON 包

**实现步骤：**
1. 前端不再直接导入 JSON 文件
2. 通过 API 动态加载 JSON 包
3. API 返回最新版本的 JSON 包

**优点：**
- 完全控制版本更新
- 不需要重新构建前端

**缺点：**
- 需要额外的网络请求
- 需要修改前端逻辑

## 推荐方案

**推荐使用方案1 + 方案3的组合：**
1. 前端通过 API 获取最新版本号
2. 如果版本不匹配，通过 API 动态加载 JSON 包
3. 缓存 JSON 包到 localStorage，使用版本号作为 key

这样可以：
- 自动检测新版本
- 不需要重新构建前端
- 减少网络请求（使用 localStorage 缓存）


