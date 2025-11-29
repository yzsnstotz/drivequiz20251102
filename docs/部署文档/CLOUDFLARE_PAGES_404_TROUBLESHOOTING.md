# Cloudflare Pages 404 错误故障排除指南

## 问题描述

部署成功后访问 Cloudflare Pages URL 出现 404 错误。

## 可能的原因和解决方案

### 1. 检查构建输出

确保构建成功生成了 `worker.js` 文件：

```bash
# 本地构建后检查
npm run cf:build
ls -la .open-next/worker.js
```

**如果 `worker.js` 不存在：**
- 检查构建日志是否有错误
- 确保 `@opennextjs/cloudflare` 正确安装
- 尝试重新构建

### 2. 检查 Cloudflare Pages 配置

在 Cloudflare Dashboard 中检查：

1. **Framework preset（重要）**：
   - 进入项目 → **Settings** → **Builds & deployments**
   - 将 **Framework preset** 设置为 **"None"**
   - **不要选择 "Next.js"**，因为 OpenNext 有自己的构建流程
   - 这是导致 404 错误的常见原因

2. **构建输出目录**：
   - Settings → Builds & deployments
   - 输出目录应设置为：`.open-next`

3. **构建命令**：
   - 确保使用：`npm install --include=optional && npm install @ast-grep/napi-linux-x64-gnu@0.35.0 --save-optional --force && npm run cf:build`

4. **Functions 设置**：
   - 进入项目 → **Settings** → **Functions**
   - 确保 **"Pages Functions"** 已启用（如果找不到此选项，可能不需要配置）

5. **Worker 入口点**：
   - 检查部署的文件中是否包含 `.open-next/_worker.js`
   - 如果没有，需要重新部署（构建脚本会自动创建）

### 3. 检查路由配置

确保 `.open-next/_routes.json` 文件存在且配置正确：

```json
{
  "version": 1,
  "include": ["/*"],
  "exclude": []
}
```

### 4. 检查环境变量

确保所有必需的环境变量都已设置：

```bash
# 使用 wrangler secret put 设置
npx wrangler secret put DATABASE_URL
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_SERVICE_KEY
npx wrangler secret put USER_JWT_SECRET
```

### 5. 使用 Cloudflare Workers 而不是 Pages

如果 Pages 部署有问题，可以考虑直接使用 Cloudflare Workers：

1. 在 Cloudflare Dashboard 创建 **Workers** 项目（不是 Pages）
2. 使用 `wrangler deploy` 命令部署：

```bash
npm run cf:deploy
```

### 6. 检查部署日志

在 Cloudflare Dashboard 中：
1. 进入项目 → Deployments
2. 查看最新部署的日志
3. 检查是否有错误或警告

### 7. 验证构建输出结构

OpenNext Cloudflare 应该生成以下结构：

```
.open-next/
├── worker.js          # Worker 入口文件（必需）
├── assets/            # 静态资源
├── _routes.json       # 路由配置
└── ...
```

如果缺少 `worker.js`，构建可能失败。

## 快速检查清单

- [ ] 构建成功完成（无错误）
- [ ] `.open-next/worker.js` 文件存在
- [ ] Cloudflare Pages 输出目录设置为 `.open-next`
- [ ] 所有环境变量已配置
- [ ] `_routes.json` 文件存在
- [ ] 项目类型支持 Workers/Functions

## 如果问题仍然存在

1. **查看构建日志**：检查 Cloudflare 构建日志中的错误信息
2. **本地测试**：运行 `npm run cf:preview` 在本地测试
3. **检查 OpenNext 版本**：确保使用最新版本的 `@opennextjs/cloudflare`
4. **查看官方文档**：参考 [OpenNext Cloudflare 文档](https://opennext.js.org/cloudflare)

## 替代方案

如果 Cloudflare Pages 部署持续有问题，可以考虑：

1. **使用 Cloudflare Workers**：直接部署为 Worker 而不是 Page
2. **使用 Vercel**：如果 Cloudflare 部署太复杂，Vercel 对 Next.js 支持更好
3. **使用其他平台**：Render、Railway 等也支持 Next.js 部署

