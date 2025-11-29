# 🚀 ZALEM 前台系统 - 部署指南

**版本**：v1.0  
**更新日期**：2025-11-12  
**部署平台**：Vercel

---

## 📋 目录

1. [快速开始](#快速开始)
2. [Vercel Preview 流程](#vercel-preview-流程)
3. [环境变量清单](#环境变量清单)
4. [常见故障排查](#常见故障排查)
5. [部署检查清单](#部署检查清单)

---

## 🚀 快速开始

### 1. 本地开发环境设置

```bash
# 1. 克隆仓库
git clone <repository-url>
cd "New Front End"

# 2. 安装依赖
npm install

# 3. 复制环境变量模板
cp .env.example .env.local

# 4. 编辑 .env.local，填入实际配置
# 必需变量：DATABASE_URL

# 5. 运行开发服务器
npm run dev
```

### 2. Vercel 部署

#### 首次部署

1. **连接 GitHub 仓库**
   - 登录 [Vercel Dashboard](https://vercel.com/dashboard)
   - 点击 "Add New Project"
   - 选择 GitHub 仓库并导入

2. **配置环境变量**
   - 进入项目 Settings → Environment Variables
   - 参考 [环境变量清单](#环境变量清单) 添加必需变量

3. **部署**
   - Vercel 会自动检测 Next.js 项目并部署
   - 等待构建完成

#### 后续部署

- **自动部署**：推送到 `main` 分支自动触发 Production 部署
- **Preview 部署**：推送到其他分支自动创建 Preview 环境

---

## 🔄 Vercel Preview 流程

### Preview 环境特点

- **自动创建**：每次推送到非 `main` 分支时自动创建
- **独立环境**：每个 Preview 环境有独立的 URL
- **环境变量**：继承 Production 环境变量，可单独覆盖

### Preview 部署流程

```
开发者推送代码到 feature 分支
    ↓
GitHub Webhook 触发 Vercel
    ↓
Vercel 检测到新分支
    ↓
自动创建 Preview 环境
    ↓
执行构建和部署
    ↓
生成 Preview URL（如：xxx-feature-branch.vercel.app）
    ↓
在 GitHub PR 中显示 Preview 链接
```

### Preview 环境变量配置

1. **继承 Production 变量**
   - Preview 环境默认继承 Production 的环境变量
   - 可在 Preview 环境中单独覆盖

2. **添加 Preview 专用变量**
   - 进入 Settings → Environment Variables
   - 选择 "Preview" 环境
   - 添加或覆盖变量

### Preview 与 Production 差异

| 特性 | Preview | Production |
|------|---------|------------|
| **URL** | `xxx-branch.vercel.app` | `your-domain.com` |
| **触发** | 每次推送 | 仅 `main` 分支 |
| **环境变量** | 继承 Production，可覆盖 | 独立配置 |
| **缓存** | 较少缓存 | 完整缓存 |
| **性能** | 可能较慢 | 优化后 |

---

## 🔑 环境变量清单

### 必需变量（Production）

| 变量名 | 说明 | 示例值 | 来源 |
|--------|------|--------|------|
| `DATABASE_URL` | PostgreSQL 连接字符串 | `postgresql://...` | Supabase Dashboard |
| `POSTGRES_URL` | 备用数据库连接（Vercel 使用） | `postgresql://...` | Supabase Dashboard |

### 可选变量（前台相关）

| 变量名 | 说明 | 默认值 | 备注 |
|--------|------|--------|------|
| `NEXT_PUBLIC_APP_BASE_URL` | 应用基础 URL | `http://localhost:3000` | 用于生成完整链接 |
| `NEXT_PUBLIC_AI_API_BASE` | AI API 基础 URL | 空（使用 `/api/ai/ask`） | 可选，本 PR 不依赖 |

### AI 服务变量（可选，本 PR 不依赖）

| 变量名 | 说明 | 默认值 | 备注 |
|--------|------|--------|------|
| `AI_SERVICE_URL` | AI 服务 URL | - | 在线服务地址 |
| `AI_SERVICE_TOKEN` | AI 服务 Token | - | 服务认证令牌 |
| `USE_LOCAL_AI` | 是否使用本地 AI | `false` | `true`/`false` |
| `LOCAL_AI_SERVICE_URL` | 本地 AI 服务 URL | - | 仅在 `USE_LOCAL_AI=true` 时使用 |
| `LOCAL_AI_SERVICE_TOKEN` | 本地 AI 服务 Token | - | 本地服务认证 |

### JWT 配置（用户认证）

| 变量名 | 说明 | 来源 |
|--------|------|------|
| `USER_JWT_SECRET` | 用户 JWT 密钥（HS256） | 自行生成 |
| `USER_JWT_PUBLIC_KEY` | 用户 JWT 公钥（RS256，PEM 格式） | Supabase Dashboard |

### 系统变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `TZ` | 时区 | `UTC` |
| `NODE_ENV` | Node.js 环境 | `production`（Vercel 自动设置） |
| `VERCEL_ENV` | Vercel 环境 | `production`/`preview`/`development` |

---

## 🔧 常见故障排查

### 1. 数据库连接失败

**症状**：API 返回 500 错误，日志显示数据库连接失败

**排查步骤**：

1. **检查环境变量**
   ```bash
   # 在 Vercel Dashboard 中检查
   Settings → Environment Variables → DATABASE_URL
   ```

2. **验证连接字符串格式**
   ```
   正确格式: postgresql://user:password@host:port/database
   ```

3. **检查 Supabase 连接池**
   - 使用 Supabase 的连接池 URL（`xxx.pooler.supabase.com`）
   - 确保连接池已启用

4. **测试连接**
   ```bash
   # 本地测试
   psql $DATABASE_URL -c "SELECT 1;"
   ```

**解决方案**：
- 更新 `DATABASE_URL` 为正确的连接字符串
- 确保 Supabase 项目已启用连接池
- 重新部署应用

---

### 2. 环境变量未生效

**症状**：代码中读取的环境变量为 `undefined`

**排查步骤**：

1. **检查变量名拼写**
   - 确保变量名与代码中一致（区分大小写）

2. **检查环境范围**
   - 确保变量已添加到正确的环境（Production/Preview/Development）

3. **重新部署**
   - 环境变量更改后需要重新部署才能生效

**解决方案**：
- 在 Vercel Dashboard 中检查变量名和值
- 触发重新部署：Deployments → 最新部署 → Redeploy

---

### 3. Preview 环境无法访问数据库

**症状**：Preview 环境返回数据库错误，但 Production 正常

**排查步骤**：

1. **检查 Preview 环境变量**
   - Settings → Environment Variables → 选择 "Preview"
   - 确认 `DATABASE_URL` 已配置

2. **检查环境变量继承**
   - Preview 默认继承 Production 变量
   - 如果 Production 正常，Preview 应该也能访问

**解决方案**：
- 在 Preview 环境中显式添加 `DATABASE_URL`
- 确保数据库允许来自 Vercel 的 IP 访问

---

### 4. 构建失败

**症状**：Vercel 构建日志显示错误

**常见原因**：

1. **TypeScript 错误**
   ```bash
   # 本地检查
   npx tsc --noEmit
   ```

2. **ESLint 错误**
   ```bash
   # 本地检查
   npx eslint apps/web --max-warnings=0
   ```

3. **依赖安装失败**
   - 检查 `package.json` 中的依赖版本
   - 确保 Node.js 版本兼容

**解决方案**：
- 修复本地 TypeScript/ESLint 错误
- 检查 `package.json` 和 `package-lock.json`
- 查看 Vercel 构建日志获取详细错误信息

---

### 5. API 路由 404

**症状**：访问 API 路由返回 404

**排查步骤**：

1. **检查路由文件位置**
   ```
   正确位置: src/app/api/[route]/route.ts
   ```

2. **检查路由导出**
   ```typescript
   // 确保导出了 GET/POST 等函数
   export async function GET(request: NextRequest) { ... }
   ```

3. **检查动态路由**
   ```
   动态路由: src/app/api/exam/[set]/route.ts
   访问: /api/exam/1
   ```

**解决方案**：
- 确认路由文件在正确位置
- 检查路由函数是否正确导出
- 查看 Vercel 函数日志

---

## ✅ 部署检查清单

### 部署前检查

- [ ] 本地 `npx tsc --noEmit` 通过（0 错误）
- [ ] 本地 `npx eslint apps/web --max-warnings=0` 通过
- [ ] 本地 `npm run build` 成功
- [ ] 所有环境变量已在 Vercel Dashboard 配置
- [ ] 数据库连接字符串正确
- [ ] `.env.local` 未提交到 Git（已在 `.gitignore` 中）

### 部署后验证

- [ ] 访问 Production URL，页面正常加载
- [ ] 测试关键 API 路由：
  ```bash
  curl https://your-domain.vercel.app/api/vehicles?page=1&limit=5
  curl https://your-domain.vercel.app/api/services?page=1&limit=5
  curl https://your-domain.vercel.app/api/exam/1?licenseType=provisional
  ```
- [ ] 检查 Vercel 函数日志，无错误
- [ ] 测试用户流程（语言选择 → 激活 → 问卷 → 设置）

### Preview 环境验证

- [ ] Preview URL 可访问
- [ ] Preview 环境变量已配置（如需要）
- [ ] Preview 环境功能正常
- [ ] 在 GitHub PR 中显示 Preview 链接

---

## 📚 相关文档

- [环境变量配置指南](./ENV_SETUP.md)
- [Vercel 环境变量工作流程](./VERCEL_ENV_FLOW.md)
- [AI 服务环境变量配置](./AI_ENV_SETUP.md)
- [Preview 环境配置](./PREVIEW_ENV_SETUP.md)

---

## 🆘 获取帮助

如果遇到问题：

1. **查看 Vercel 构建日志**
   - Dashboard → Deployments → 选择部署 → View Function Logs

2. **检查 API 路由日志**
   - Dashboard → Functions → 选择函数 → View Logs

3. **联系团队**
   - 在 GitHub Issues 中报告问题
   - 提供完整的错误日志和复现步骤

---

**最后更新**：2025-11-12  
**维护者**：ZALEM 开发团队

