# 🔄 Vercel 环境变量工作流程

## 📊 流程图

```
┌─────────────────────────────────────────────────────────────┐
│                    本地开发环境                               │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  1. 创建 .env.local 文件                                      │
│     └── DATABASE_URL=postgresql://...                        │
│                                                               │
│  2. Next.js 自动读取 .env.local                               │
│     └── 加载到 process.env                                    │
│                                                               │
│  3. 应用代码读取                                              │
│     const dbUrl = process.env.DATABASE_URL;                   │
│                                                               │
└─────────────────────────────────────────────────────────────┘

                    ⬇️ Git Push
                    
┌─────────────────────────────────────────────────────────────┐
│                    Git 仓库                                   │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ✅ 代码文件                                                  │
│  ✅ .env.example (模板，不含真实密码)                          │
│  ❌ .env.local (在 .gitignore 中，不提交)                    │
│                                                               │
└─────────────────────────────────────────────────────────────┘

                    ⬇️ Vercel 自动部署
                    
┌─────────────────────────────────────────────────────────────┐
│                  Vercel Dashboard                             │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Settings → Environment Variables                             │
│  ┌─────────────────────────────────────────┐                │
│  │ DATABASE_URL = postgresql://...         │                │
│  │ ADMIN_TOKEN = your-token-here           │                │
│  │ TZ = UTC                                │                │
│  └─────────────────────────────────────────┘                │
│                                                               │
│  ⚠️ 注意：这些值存储在 Vercel 服务器，加密保存                │
│     只有项目管理员可以查看                                    │
│                                                               │
└─────────────────────────────────────────────────────────────┘

                    ⬇️ 部署时注入
                    
┌─────────────────────────────────────────────────────────────┐
│              Vercel 生产环境（运行时）                        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  1. Vercel 从 Dashboard 读取环境变量                         │
│                                                               │
│  2. 在部署时注入到运行时环境                                   │
│     process.env.DATABASE_URL = "postgresql://..."            │
│                                                               │
│  3. 应用代码读取（与本地完全一致）                            │
│     const dbUrl = process.env.DATABASE_URL;                  │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## 🔑 关键要点

### 1. Vercel 不读取 `.env` 文件

- ❌ Vercel **不会**读取 Git 仓库中的 `.env` 文件
- ❌ 即使提交了 `.env` 文件，Vercel 也不会使用
- ✅ 环境变量必须通过 **Vercel Dashboard** 配置

### 2. 配置方式

**本地开发：**
```bash
# 创建 .env.local 文件
cp .env.example .env.local

# 编辑并填入实际配置
vim .env.local
```

**Vercel 生产环境：**
```
1. 登录 Vercel Dashboard
2. 选择项目 → Settings → Environment Variables
3. 点击 Add 添加环境变量
4. 填入变量名和值
5. 选择适用的环境（Production/Preview/Development）
6. 保存并重新部署
```

### 3. 代码无需修改

**本地和 Vercel 使用相同的代码：**

```typescript
// src/lib/db.ts
function getConnectionString(): string {
  // 本地：从 .env.local 读取
  // Vercel：从 Dashboard 配置读取
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  return connectionString;
}
```

**无论在哪里运行，读取方式完全一致！**

## 🆚 对比表

| 特性 | 本地开发 | Vercel 生产环境 |
|------|---------|----------------|
| **配置方式** | `.env.local` 文件 | Vercel Dashboard |
| **存储位置** | 本地文件系统 | Vercel 服务器（加密） |
| **可见性** | 本地开发者可见 | 仅项目管理员可见 |
| **Git 提交** | ❌ 不应该提交 | ❌ 不需要提交 |
| **代码读取** | `process.env.VAR` | `process.env.VAR` |
| **安全性** | 本地文件风险低 | 服务器端加密存储 |

## ✅ 最佳实践

1. **永远不要提交 `.env` 文件到 Git**
   - 已在 `.gitignore` 中
   - 使用 `.env.example` 作为模板

2. **本地开发使用 `.env.local`**
   - 不提交到 Git
   - 每个开发者创建自己的 `.env.local`

3. **生产环境通过 Vercel Dashboard 配置**
   - 不要依赖 Git 中的 `.env` 文件
   - 手动在 Dashboard 中配置所有必需的环境变量

4. **验证配置**
   - 本地：`curl http://localhost:3000/api/admin/diagnose`
   - Vercel：`curl https://your-domain.vercel.app/api/admin/diagnose`

## 🔍 常见误解

### ❌ 误解 1: "我需要在 Git 中提交 .env 文件，这样 Vercel 才能读取"

**事实：** Vercel 不会读取 Git 中的 `.env` 文件，必须在 Dashboard 中配置。

### ❌ 误解 2: "本地和 Vercel 的代码需要不同"

**事实：** 代码完全相同，都是通过 `process.env` 读取，只是配置方式不同。

### ❌ 误解 3: "我可以提交一个 `.env.production` 文件"

**事实：** 即使创建了 `.env.production`，Vercel 也不会自动读取，必须在 Dashboard 中配置。

---

**总结：本地用 `.env.local`，生产用 Dashboard 配置，代码完全一样！** ✨

