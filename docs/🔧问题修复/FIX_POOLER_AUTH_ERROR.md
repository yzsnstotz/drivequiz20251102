# 🔧 修复 Pooler 认证错误 "Tenant or user not found"

## ❌ 问题症状

日志显示：
```
error: Tenant or user not found
code: 'XX000'
```

**诊断**: Pooler 连接字符串认证失败

## 🔍 测试结果

经过测试，发现：
- ✅ **直接连接（端口 5432）**: 连接成功，可以查询数据
- ❌ **Pooler（端口 6543）**: 认证失败 "Tenant or user not found"

## ✅ 解决方案

### 方案 1: 使用直接连接（推荐，已验证可用）

**测试结果**: ✅ 直接连接可以正常工作

**连接字符串**:
```
postgresql://postgres:zKV0rtIV1QOByu89@db.cgpmpfnjzlzbquakmmrj.supabase.co:5432/postgres?sslmode=require
```

**在 Vercel 中配置**:
1. 进入 Vercel Dashboard → 项目 → Settings → Environment Variables
2. 更新 `AI_DATABASE_URL` 为上面的直接连接字符串
3. 保存并重新部署

**注意**: 
- 如果数据库暂停，直接连接会失败（DNS 解析错误）
- 如果数据库活跃，直接连接可以正常工作

### 方案 2: 获取正确的 Pooler 连接字符串

如果必须使用 Pooler（例如需要高并发），请从 Supabase Dashboard 获取正确的连接字符串：

1. 登录 [Supabase Dashboard](https://app.supabase.com)
2. 进入项目 `cgpmpfnjzlzbquakmmrj`
3. 进入 **Settings** → **Database**
4. 找到 **Connection Pooling** 部分
5. 选择 **URI** 格式
6. **复制完整的 Pooler 连接字符串**（不要手动构造）

**重要**: 
- Pooler 连接字符串必须从 Supabase Dashboard 复制
- 不同区域的项目，Pooler URL 可能不同
- 用户名格式应该是 `postgres.PROJECT_ID`，但必须与 Supabase Dashboard 中的一致

### 方案 3: 确保数据库活跃

如果使用直接连接，确保数据库没有被暂停：

1. 登录 Supabase Dashboard
2. 检查项目状态
3. 如果暂停，点击 **Resume** 恢复数据库
4. 等待 1-2 分钟让数据库完全启动

## 📊 连接方式对比

| 特性 | 直接连接 (5432) | 连接池 (6543) |
|------|----------------|--------------|
| **当前状态** | ✅ 可用 | ❌ 认证失败 |
| **连接稳定性** | 需要数据库活跃 | 更稳定 |
| **Vercel 兼容性** | ✅ 已验证 | ⚠️ 需要正确配置 |
| **用户名格式** | `postgres` | `postgres.PROJECT_ID` |
| **端口** | `5432` | `6543` |
| **特殊参数** | `sslmode=require` | `pgbouncer=true&sslmode=require` |

## 🎯 推荐配置

**当前推荐**: 使用直接连接（端口 5432）

```
AI_DATABASE_URL=postgresql://postgres:zKV0rtIV1QOByu89@db.cgpmpfnjzlzbquakmmrj.supabase.co:5432/postgres?sslmode=require
```

**原因**:
- ✅ 已验证可用
- ✅ 连接成功
- ✅ 可以正常查询数据

## ⚠️ 如果直接连接在 Vercel 中失败

如果直接连接在 Vercel 中仍然失败（DNS 解析错误），可能的原因：

1. **数据库已暂停**: 检查 Supabase Dashboard，恢复数据库
2. **网络限制**: Vercel 可能无法访问直接连接（某些网络环境）

**解决方案**:
- 从 Supabase Dashboard 获取正确的 Pooler 连接字符串
- 确保数据库活跃后再使用直接连接

## 📝 验证步骤

1. 更新 Vercel 环境变量
2. 重新部署应用
3. 检查日志，应该看到：
   - ✅ 连接成功
   - ✅ 查询执行成功
   - ❌ 不再出现 "Tenant or user not found" 错误

