# Cloudflare 部署配置指南

## 🔧 修复的问题

### 1. package-lock.json 同步问题

已更新 `package-lock.json` 以确保与 `package.json` 同步。请确保提交到 Git：

```bash
git add package-lock.json
git commit -m "chore: 更新 package-lock.json 以修复 Cloudflare 构建"
git push
```

### 2. Cloudflare Dashboard 配置

在 Cloudflare Dashboard 中配置以下设置：

#### 构建配置

1. 进入你的 Cloudflare Workers/Pages 项目
2. 进入 **Settings** → **Builds & deployments**
3. **重要：Framework preset 设置**
   - 将 **Framework preset** 设置为 **"None"**（不要选择 "Next.js"）
   - 原因：OpenNext 有自己的构建流程，使用 Cloudflare 默认的 Next.js 构建会导致冲突
4. 配置以下设置：

**构建命令：**

⚠️ **重要**：Cloudflare Pages 默认使用 `npm ci`，它不会安装可选依赖。必须使用自定义构建命令。

推荐使用构建脚本（会自动处理依赖安装）：
```bash
bash _build.sh
```

或者手动指定完整命令：
```bash
npm install --include=optional && npm install @ast-grep/napi-linux-x64-gnu@0.35.0 --save-optional --force && npm run cf:build
```

或者分步执行：
```bash
npm install --include=optional
npm install @ast-grep/napi-linux-x64-gnu@0.35.0 --save-optional --force
npx @opennextjs/cloudflare build
```

**为什么需要这样做？**
- `@ast-grep/napi-linux-x64-gnu` 是可选依赖，`npm ci` 默认不会安装
- Cloudflare 构建环境是 Linux x64，需要这个平台特定的原生模块
- 必须显式安装以确保构建成功

**输出目录：**
```
.open-next
```

**根目录：**
```
/（项目根目录）
```

**重要提示：**
- OpenNext Cloudflare 会生成 Worker 文件（`.open-next/worker.js`）
- Cloudflare Pages 需要 `_worker.js` 作为入口点（构建脚本会自动创建）
- 确保 Cloudflare Pages 项目类型设置为 **"Workers"** 或 **"Full Stack"**
- 如果仍然出现 404，可能需要检查：
  1. 构建输出是否包含 `worker.js` 和 `_worker.js` 文件
  2. Cloudflare Pages 是否正确识别了 Worker 入口
  3. 环境变量是否正确配置
  4. 在 Cloudflare Dashboard → Functions 中检查是否启用了 Pages Functions

#### 环境变量配置

在 **Settings** → **Environment Variables** 中设置以下 secrets（使用 `wrangler secret put` 命令）：

```bash
# 必需的环境变量
npx wrangler secret put DATABASE_URL
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_SERVICE_KEY
npx wrangler secret put USER_JWT_SECRET

# 如果使用 AI 数据库
npx wrangler secret put AI_DATABASE_URL
```

### 3. 使用 wrangler.toml

确保 `wrangler.toml` 文件在项目根目录，Cloudflare 会自动读取。

**重要配置：**
- `pages_build_output_dir = ".open-next"` - Cloudflare Pages 需要的输出目录配置
- **注意**：Pages 项目不支持 `main` 和 `assets` 配置项（这些是 Workers 专用的）

### 4. 本地测试构建

在部署前，可以在本地测试构建：

```bash
# 测试构建
npm run cf:build

# 本地预览
npm run cf:preview

# 部署
npm run cf:deploy
```

## 📝 注意事项

1. **package-lock.json 必须提交**：Cloudflare 使用 `npm ci` 需要完全同步的 lock 文件
2. **构建命令**：确保使用 `npm run cf:build` 而不是默认的 `npm run build`
3. **环境变量**：所有敏感信息必须通过 `wrangler secret put` 设置
4. **wrangler.toml**：确保文件在根目录，Cloudflare 会自动检测

## 🚀 部署流程

1. 提交代码到 Git（包括 `package-lock.json`）
2. 在 Cloudflare Dashboard 配置构建命令
3. 设置环境变量 secrets
4. 触发部署或等待自动部署

