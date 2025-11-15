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
3. 配置以下设置：

**构建命令：**
```bash
npm install --include=optional && npm run cf:build
```

或者直接使用 npx：
```bash
npm install --include=optional && npx @opennextjs/cloudflare build
```

**重要**：必须使用 `--include=optional` 标志，以确保安装所有平台特定的原生模块（如 `@ast-grep/napi-linux-x64-gnu`）。

或者使用构建脚本：
```bash
bash _build.sh
```

**输出目录：**
```
.open-next
```

**根目录：**
```
/（项目根目录）
```

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

