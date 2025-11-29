# 📝 环境变量配置指南

## 🔒 重要安全提示

**⚠️ 绝对不要将包含真实密码的 `.env` 或 `.env.local` 文件提交到 Git！**

- ✅ `.env` 和 `.env.local` 已在 `.gitignore` 中，不会被提交
- ✅ 使用 `.env.example` 作为模板
- ❌ 不要在公开仓库中暴露数据库密码、API 密钥等敏感信息

---

## 📋 环境变量配置步骤

### ✅ `.env` 和 `.env.local` 文件主要用于本地开发

**Next.js 环境变量文件优先级：**
1. `.env.local` - 本地覆盖（最高优先级，不会被提交到 Git）
2. `.env` - 默认环境变量（如果提交到 Git，会被使用，但不推荐）
3. `.env.example` - 模板文件（提交到 Git，不含真实密码）

**注意：**
- ✅ **本地开发**：Next.js 会自动读取 `.env.local` 和 `.env` 文件
- ✅ **Vercel 部署**：不读取这些文件，必须通过 Dashboard 配置
- ✅ **其他部署方式**（如 Docker、传统服务器）：可能需要 `.env` 文件

### 1. 本地开发环境

```bash
# 复制模板文件
cp .env.example .env.local

# 编辑 .env.local，填入实际的配置值
# （使用你喜欢的编辑器，如 vim, nano, VS Code 等）
```

**必需的环境变量：**
- `DATABASE_URL`: 数据库连接字符串
- `ADMIN_TOKEN`: 管理员 Token（用于 API 鉴权）
- `TZ`: 时区（建议 `UTC`）

**Next.js 会自动读取 `.env.local` 文件，并注入到 `process.env`**

### 2. 生产环境（Vercel）

**🔑 关键点：Vercel 不读取 `.env` 文件，而是通过 Dashboard 配置环境变量！**

Vercel 的工作方式：
1. **不依赖 `.env` 文件** - Vercel 不会读取你提交到 Git 的 `.env` 文件（即使提交了也不安全）
2. **通过 Dashboard 配置** - 环境变量通过 Vercel Dashboard 的界面配置，存储在 Vercel 的服务器上
3. **应用读取方式** - 应用代码通过 `process.env.VARIABLE_NAME` 读取，就像读取本地 `.env` 一样

#### 配置步骤（详细）

**Step 1: 登录 Vercel Dashboard**
- 访问 [Vercel Dashboard](https://vercel.com/dashboard)
- 登录你的账户

**Step 2: 选择项目**
- 在项目列表中找到你的项目
- 点击项目名称进入项目详情

**Step 3: 进入环境变量设置**
- 点击顶部菜单 **Settings**
- 在左侧菜单中找到 **Environment Variables**
- 点击进入环境变量配置页面

**Step 4: 添加环境变量**
点击 **Add** 按钮，逐个添加以下变量：

| 变量名 | 值（示例） | 说明 | 环境 |
|--------|-----------|------|------|
| `DATABASE_URL` | `postgresql://postgres:PASSWORD@db.PROJECT_REF.supabase.co:5432/postgres?sslmode=require` | 数据库连接字符串 | Production, Preview, Development |
| `ADMIN_TOKEN` | `your-secure-token-here` | 管理员 Token | Production, Preview, Development |
| `TZ` | `UTC` | 时区 | Production, Preview, Development |

**重要提示：**
- 为每个变量选择适用的环境（Production、Preview、Development）
- 生产环境建议只选择 **Production**，避免在预览环境暴露敏感信息
- 值会被加密存储，只有项目管理员可见

**Step 5: 保存并重新部署**
- 点击 **Save** 保存所有环境变量
- 进入 **Deployments** 页面
- 点击最新部署右侧的 **...** 菜单，选择 **Redeploy**
- 或者在下次代码推送时自动触发部署

#### 工作原理说明

```
本地开发：
├── .env.local 文件
│   └── DATABASE_URL=postgresql://...
├── Next.js 读取
│   └── process.env.DATABASE_URL
└── 应用代码使用

Vercel 生产环境：
├── Vercel Dashboard 配置
│   └── DATABASE_URL=postgresql://... (存储在 Vercel 服务器)
├── 部署时注入到环境
│   └── 作为 process.env.DATABASE_URL 注入到运行时
└── 应用代码使用（代码完全一样！）
```

**代码层面不需要改动** - 你的代码使用 `process.env.DATABASE_URL`，无论是在本地还是 Vercel，读取方式完全一致。

#### 验证环境变量是否生效

部署后，可以通过以下方式验证：

1. **诊断 API**
   ```bash
   curl https://your-domain.vercel.app/api/admin/diagnose
   ```
   返回结果中会显示环境变量状态

2. **检查日志**
   - 在 Vercel Dashboard 的 **Deployments** 页面
   - 点击部署查看构建日志
   - 确保没有环境变量缺失的警告

---

## 🔍 如何获取数据库连接字符串

### Supabase 数据库

1. 登录 [Supabase Dashboard](https://app.supabase.com/)
2. 进入您的项目
3. 点击 **Settings** → **Database**
4. 找到 **Connection string** 部分
5. 选择 **URI** 格式
6. 确保选择的是 **Direct connection**（不是 Pooler）
7. 复制完整的连接字符串
8. 将连接字符串填入 `.env.local` 的 `DATABASE_URL`

**连接字符串格式：**
```
postgresql://postgres:PASSWORD@db.PROJECT_REF.supabase.co:5432/postgres?sslmode=require
```

---

## 🆘 常见问题

### Q1: 如果 .env 文件不同步到 Git，如何让其他开发者知道配置？

**A:** 使用 `.env.example` 文件作为模板。其他开发者可以：
1. 复制 `.env.example` 为 `.env.local`
2. 填入自己的配置值
3. 阅读 `docs/ENV_SETUP.md` 获取详细说明

### Q2: Git 上的 .env 如果是公开项目，数据库连接信息会暴露吗？

**A:** 是的！**绝对会暴露**！

**如果 `.env` 文件被提交到公开的 Git 仓库：**
- ❌ 任何人都可以看到数据库密码
- ❌ 任何人都可以连接并操作你的数据库
- ❌ 可能导致数据泄露、数据被篡改等严重后果

**解决方案：**
1. ✅ **永远不要**提交 `.env` 文件到 Git
2. ✅ 确保 `.gitignore` 包含 `.env` 和 `.env.local`
3. ✅ 如果不小心提交了，**立即修改密码**，并从 Git 历史中删除
4. ✅ 使用 `.env.example` 作为模板（不含真实密码）

### Q3: 部署到 Vercel 的项目是如何读取到真实 .env 信息的？

**A:** Vercel **不读取 `.env` 文件**，而是通过 **Dashboard 配置界面** 设置环境变量。

**详细说明：**

1. **Vercel 的工作方式**
   - Vercel **不会**读取 Git 仓库中的 `.env` 文件
   - 即使你提交了 `.env` 文件，Vercel 也不会使用它（而且提交 `.env` 是不安全的）
   - 环境变量必须通过 **Vercel Dashboard** 手动配置

2. **配置方式**
   - 登录 Vercel Dashboard → 选择项目 → Settings → Environment Variables
   - 在界面中添加环境变量（如 `DATABASE_URL`、`ADMIN_TOKEN` 等）
   - 环境变量存储在 Vercel 的服务器上，加密保存
   - 只有项目管理员可以查看和编辑

3. **应用如何读取**
   - 你的代码使用 `process.env.DATABASE_URL` 读取环境变量
   - Vercel 在部署时将配置的环境变量注入到运行时的 `process.env`
   - **代码层面完全一致**，不需要任何修改

4. **为什么这样设计？**
   - ✅ **安全性** - 敏感信息不会出现在 Git 历史中
   - ✅ **灵活性** - 不同环境（Production、Preview、Development）可以使用不同的配置
   - ✅ **隔离性** - 每个项目独立配置，不会相互影响

**示例流程：**
```
开发者操作：
1. 本地开发：创建 .env.local，填入配置
2. 提交代码：只提交代码，不提交 .env.local
3. 配置生产环境：在 Vercel Dashboard 中配置环境变量
4. 部署：Vercel 自动读取 Dashboard 中的配置并注入到应用

应用代码（无需改动）：
const dbUrl = process.env.DATABASE_URL; // 本地和 Vercel 都能读取
```

### Q4: 已经提交了包含敏感信息的 .env 文件怎么办？

**A:** 立即采取以下措施：

1. **立即修改所有暴露的密码/密钥**
   - 数据库密码
   - API 密钥
   - 其他敏感信息

2. **从 Git 历史中删除文件**
   ```bash
   # 使用 git filter-branch 或 BFG Repo-Cleaner
   # 或联系 Git 服务商删除敏感文件
   ```

3. **添加/更新 .gitignore**
   ```bash
   echo ".env" >> .gitignore
   echo ".env.local" >> .gitignore
   ```

4. **强制推送到远程**
   ```bash
   git push --force
   ```

---

## 📝 环境变量检查清单

在部署前，请确认：

- [ ] `.env.local` 文件存在于项目根目录（本地开发）
- [ ] `DATABASE_URL` 格式正确
- [ ] `ADMIN_TOKEN` 已设置
- [ ] `.env` 和 `.env.local` 在 `.gitignore` 中
- [ ] `.env.example` 已更新（不含真实密码）
- [ ] 生产环境变量已在 Vercel 中配置

---

## 🧪 验证配置

配置完成后，使用以下方式验证：

### 1. 诊断 API（推荐）

访问诊断端点查看配置状态：
```
http://localhost:3000/api/admin/diagnose
```

### 2. 测试脚本

```bash
node test-connection.js
# 或
npx tsx scripts/test-db-connection.ts
```

### 3. 检查环境变量

```bash
# 本地：检查 DATABASE_URL 是否存在（不显示内容）
grep -q DATABASE_URL .env.local && echo "✅ DATABASE_URL exists" || echo "❌ Not found"

# Vercel：访问诊断端点检查
curl https://your-domain.vercel.app/api/admin/diagnose
```

### 4. 在 Vercel Dashboard 中查看

- 进入 Vercel Dashboard → 项目 → Settings → Environment Variables
- 确认所有必需的环境变量都已配置
- 检查每个变量的环境范围（Production、Preview、Development）

---

## 📚 相关文档

- [TROUBLESHOOTING.md](../TROUBLESHOOTING.md) - 故障排除指南
- [TESTING_GUIDE.md](../TESTING_GUIDE.md) - 测试指南

