# 🔧 500 错误排查指南

## 问题现象

页面显示 500 错误，通常是因为数据库连接失败或数据库表不存在。

## 快速排查步骤

### 1. 检查环境变量配置

确保 `.env.local` 文件存在且包含正确的 `DATABASE_URL`：

```bash
# 检查文件是否存在
ls -la .env.local

# 查看文件内容（不要打印完整连接字符串，仅确认存在）
grep -q DATABASE_URL .env.local && echo "✅ DATABASE_URL exists" || echo "❌ DATABASE_URL not found"
```

`.env.local` 文件应该包含：
```
DATABASE_URL=postgresql://postgres:iK7USyhmI0IfWEfZ@db.vdtnzjvmvrcdplawwiae.supabase.co:5432/postgres?sslmode=require
ADMIN_TOKEN=your-admin-token-here
TZ=UTC
```

### 2. 使用诊断 API 端点

访问诊断端点查看详细的连接信息：

```bash
# 本地开发环境
curl http://localhost:3000/api/admin/diagnose

# 或在浏览器中访问
http://localhost:3000/api/admin/diagnose
```

诊断端点会返回：
- 环境变量状态
- 数据库连接状态
- 表结构检查结果
- 错误详情和建议

### 3. 测试数据库连接

运行测试脚本验证数据库连接：

```bash
node test-connection.js
```

或者使用 TypeScript 脚本：

```bash
npx tsx scripts/test-db-connection.ts
```

### 4. 初始化数据库表

如果数据库连接成功但表不存在，需要初始化数据库：

```bash
# 使用 TypeScript 脚本初始化
npx tsx scripts/init-cloud-database.ts
```

或者手动执行 SQL：

```bash
# 使用 psql 或 Supabase CLI
psql $DATABASE_URL -f scripts/init-cloud-database.sql
```

### 5. 检查常见问题

#### 问题 1: 环境变量未加载

**症状**: 诊断端点显示 `DATABASE_URL 未设置`

**解决方案**:
- 确保 `.env.local` 文件在项目根目录
- 重启开发服务器 (`npm run dev`)
- 确认 `.env.local` 文件内容正确

#### 问题 2: 数据库连接失败

**症状**: 诊断端点显示连接错误

**解决方案**:
- 检查 Supabase 项目是否正常运行
- 验证密码是否正确
- 检查项目 ID (`vdtnzjvmvrcdplawwiae`) 是否正确
- 确认网络连接正常

#### 问题 3: 数据库表不存在

**症状**: 诊断端点显示表缺失

**解决方案**:
```bash
# 运行初始化脚本
npx tsx scripts/init-cloud-database.ts
```

#### 问题 4: SSL 连接错误

**症状**: 诊断端点显示 SSL 错误

**解决方案**:
- 确保连接字符串包含 `?sslmode=require`
- 检查 `package.json` 中 dev 脚本是否设置了 `NODE_TLS_REJECT_UNAUTHORIZED=0`
- 在 Supabase Dashboard 中确认 SSL 模式设置

## 详细错误代码说明

API 错误响应中可能包含以下错误代码：

| 错误代码 | 说明 | 解决方案 |
|---------|------|---------|
| `DATABASE_CONNECTION_ERROR` | 数据库连接失败 | 检查环境变量和网络连接 |
| `DATABASE_TABLE_NOT_FOUND` | 数据库表不存在 | 运行初始化脚本 |
| `DATABASE_TIMEOUT` | 连接超时 | 检查网络和防火墙设置 |
| `DATABASE_SSL_ERROR` | SSL 连接错误 | 检查 SSL 配置 |
| `DATABASE_AUTH_ERROR` | 认证失败 | 检查密码是否正确 |
| `DATABASE_HOST_ERROR` | 主机地址错误 | 检查项目 ID 和主机地址 |

## 开发服务器启动

确保使用正确的启动命令：

```bash
npm run dev
```

`package.json` 中的 dev 脚本已经设置了 `NODE_TLS_REJECT_UNAUTHORIZED=0`，这对 Supabase SSL 连接是必需的。

## 获取详细错误信息

### 方法 1: 查看浏览器控制台

打开浏览器开发者工具（F12），查看 Console 标签中的错误信息。

### 方法 2: 查看服务器日志

查看运行 `npm run dev` 的终端输出，查找以 `[DB]` 或 `[GET /api/activation/check]` 开头的错误日志。

### 方法 3: 使用诊断端点

访问 `/api/admin/diagnose` 端点获取详细的诊断信息。

## 仍然无法解决？

如果以上步骤都无法解决问题，请：

1. 检查 Supabase Dashboard 中的数据库连接信息
2. 确认项目 ID 和密码是否正确
3. 尝试在 Supabase Dashboard 中测试连接
4. 查看详细的错误堆栈信息（在诊断端点响应中）

## 相关文件

- `.env.local` - 环境变量配置
- `src/lib/db.ts` - 数据库连接配置
- `scripts/init-cloud-database.ts` - 数据库初始化脚本
- `scripts/init-cloud-database.sql` - SQL 初始化脚本
- `src/app/api/admin/diagnose/route.ts` - 诊断 API 端点

