# 🚨 安全警报 - 敏感信息泄露

**检查时间**: 2025-11-04  
**严重程度**: ⚠️ **高**  
**状态**: 需要立即处理

---

## ✅ 好消息：OpenAI API Key 未泄露

经过全面检查，**OpenAI API Key 没有被提交到 git 历史中**。

- ✅ `.env.local` 文件未被提交（在 `.gitignore` 中）
- ✅ 真实的 API Key (`sk-proj-7XES8QUFUL0n...`) 未在 git 历史中发现
- ✅ 所有文档中的都是示例格式（`sk-xxx...`）

---

## ⚠️ 发现的安全问题

### 1. `.env` 文件被提交到 git

**发现**：`.env` 文件被提交到 git 历史中，包含以下敏感信息：

```
POSTGRES_URL="postgres://postgres.vdtnzjvmvrcdplawwiae:tcaZ6b577mojAkYw@aws-1-ap-southeast-1.pooler.supabase.com:6543/drive-quiz?sslmode=disable&supa=base-pooler.x"
ADMIN_TOKEN=Aa123456
TZ=UTC
```

**暴露的信息**：
- ❌ **数据库密码**：`tcaZ6b577mojAkYw`
- ❌ **ADMIN_TOKEN**：`Aa123456`
- ❌ **数据库连接字符串**（包含完整连接信息）

---

## 🔧 立即修复措施

### 步骤 1: 立即更换暴露的凭据

#### 1.1 更换数据库密码

1. **登录 Supabase Dashboard**
   - 访问 [Supabase Dashboard](https://app.supabase.com/)
   - 进入您的项目

2. **重置数据库密码**
   - 进入 **Settings** → **Database**
   - 点击 **Reset Database Password**
   - 生成新密码并保存

3. **更新连接字符串**
   - 获取新的连接字符串
   - 更新 Vercel 中的 `DATABASE_URL` 环境变量
   - 更新 Render 中的 `SUPABASE_URL` 和密码

#### 1.2 更换 ADMIN_TOKEN

1. **生成新的 ADMIN_TOKEN**
   ```bash
   # 使用随机字符串生成器
   openssl rand -base64 32
   ```

2. **更新数据库中的 Token**
   ```sql
   -- 在 Supabase SQL Editor 中执行
   UPDATE admins 
   SET token = '新的_token_值'
   WHERE token = 'Aa123456';
   ```

3. **更新环境变量**
   - **Vercel**: 更新 `ADMIN_TOKEN` 环境变量
   - **本地**: 更新 `.env.local` 文件

#### 1.3 从 Git 历史中删除 `.env` 文件

**⚠️ 重要**：即使从 `.gitignore` 中添加了 `.env`，已经提交的文件仍然在 git 历史中。

**方法 1: 使用 git filter-branch（推荐用于小仓库）**

```bash
# 从所有提交中删除 .env 文件
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch .env" \
  --prune-empty --tag-name-filter cat -- --all

# 强制推送（警告：这会重写历史）
git push origin --force --all
```

**方法 2: 使用 BFG Repo-Cleaner（推荐用于大仓库）**

```bash
# 下载 BFG
# https://rtyley.github.io/bfg-repo-cleaner/

# 删除 .env 文件
java -jar bfg.jar --delete-files .env

# 清理
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# 强制推送
git push origin --force --all
```

**方法 3: 联系 Git 服务商（GitHub/GitLab）**

如果仓库是公开的，联系服务商删除敏感文件。

---

### 步骤 2: 更新 `.gitignore`

确保 `.env` 文件在 `.gitignore` 中：

```bash
# 检查 .gitignore
cat .gitignore | grep -E "\.env|env\."

# 如果不存在，添加
echo ".env" >> .gitignore
echo ".env.local" >> .gitignore
echo ".env.*.local" >> .gitignore
```

---

### 步骤 3: 验证修复

1. **确认 `.env` 不再被跟踪**
   ```bash
   git ls-files | grep "\.env"
   # 应该没有输出（除了 .env.example）
   ```

2. **测试新的凭据**
   - 测试数据库连接
   - 测试管理员登录
   - 确认所有功能正常

---

## 📋 检查清单

- [ ] 更换数据库密码
- [ ] 更换 ADMIN_TOKEN
- [ ] 更新所有环境变量（Vercel、Render、本地）
- [ ] 从 git 历史中删除 `.env` 文件
- [ ] 确认 `.gitignore` 正确配置
- [ ] 测试所有功能是否正常
- [ ] 通知团队成员更新本地配置

---

## 🔒 预防措施

### 1. 永远不要提交敏感文件

- ✅ `.env` 文件已在 `.gitignore` 中
- ✅ `.env.local` 文件已在 `.gitignore` 中
- ✅ 使用 `.env.example` 作为模板（不含真实值）

### 2. 使用环境变量

- ✅ 所有敏感信息都通过环境变量读取
- ✅ 不要硬编码密码、密钥等

### 3. 定期审查

- 定期检查 git 历史中是否有敏感信息
- 使用 `git-secrets` 或类似工具防止提交敏感信息

### 4. 使用预提交钩子

```bash
# 安装 git-secrets
brew install git-secrets

# 配置
git secrets --install
git secrets --register-aws
```

---

## 📊 受影响的范围

| 信息类型 | 是否泄露 | 严重程度 | 需要操作 |
|---------|---------|---------|---------|
| OpenAI API Key | ❌ 未泄露 | - | 无需操作 |
| 数据库密码 | ✅ 已泄露 | 🔴 高 | 立即更换 |
| ADMIN_TOKEN | ✅ 已泄露 | 🔴 高 | 立即更换 |
| 数据库连接字符串 | ✅ 已泄露 | 🔴 高 | 已包含在密码更换中 |

---

## 🚨 紧急联系

如果发现异常活动：
1. 立即撤销所有暴露的凭据
2. 检查数据库访问日志
3. 检查 API 调用日志
4. 评估潜在损失

---

**结论**：OpenAI API Key 安全，但数据库密码和 ADMIN_TOKEN 需要立即更换。

