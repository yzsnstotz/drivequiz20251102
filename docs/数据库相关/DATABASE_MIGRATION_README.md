# 数据库迁移说明

## 需要执行的迁移脚本

请执行以下 SQL 脚本以创建新的数据库表：

1. **商户和视频管理表**
   - 文件：`src/migrations/20251104_create_merchants_and_videos.sql`
   - 创建表：`merchants` 和 `videos`

2. **联系信息和服务条款表**
   - 文件：`src/migrations/20251104_create_contact_info.sql`
   - 创建表：`contact_info` 和 `terms_of_service`

## 执行方式

### 方式1：通过数据库客户端执行
1. 打开你的数据库管理工具（如 pgAdmin, DBeaver, 或命令行 psql）
2. 连接到数据库
3. 依次执行上述两个 SQL 文件中的所有 SQL 语句

### 方式2：通过命令行执行
```bash
# 如果使用 PostgreSQL 命令行工具
psql -h your-host -U your-user -d your-database -f src/migrations/20251104_create_merchants_and_videos.sql
psql -h your-host -U your-user -d your-database -f src/migrations/20251104_create_contact_info.sql
```

### 方式3：通过 Vercel Postgres
如果你使用 Vercel Postgres：
1. 在 Vercel 项目设置中找到数据库连接
2. 使用 Vercel CLI 或 Web 界面执行 SQL

## 验证

执行迁移后，可以通过以下方式验证：
1. 在数据库客户端中查询表是否存在：
   ```sql
   SELECT table_name FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name IN ('merchants', 'videos', 'contact_info', 'terms_of_service');
   ```

2. 在管理后台中测试：
   - 访问 `/admin/merchants` - 应该能看到商户管理界面
   - 访问 `/admin/videos` - 应该能看到视频管理界面
   - 访问 `/admin/contact-info` - 应该能看到联系信息管理界面
   - 访问 `/admin/terms-of-service` - 应该能看到服务条款管理界面

## 注意事项

- 如果表已存在，SQL 脚本中的 `CREATE TABLE IF NOT EXISTS` 语句不会报错
- 索引创建使用 `CREATE INDEX IF NOT EXISTS`，已存在的索引不会被重复创建
- 如果执行后仍然出现 500 错误，请检查数据库连接字符串是否正确配置

