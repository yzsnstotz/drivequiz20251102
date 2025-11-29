# 🔒 数据库安全修复指南

**日期**: 2025-01-22  
**状态**: ✅ 迁移脚本已创建

---

## ✅ 已修复的问题

### 1. 函数 search_path 安全问题

**状态**: ✅ 迁移脚本已创建

**问题**: 多个函数没有设置固定的 `search_path`，可能导致 SQL 注入攻击。

**修复脚本**: 
- **推荐使用**: `src/migrations/20250122_force_fix_function_search_path.sql` (强制修复，确保所有函数正确设置)
- **备选**: `src/migrations/20250122_fix_function_search_path.sql` (如果强制修复脚本有问题)

**修复的函数**:
1. ✅ `update_services_updated_at`
2. ✅ `update_ad_content_stats`
3. ✅ `match_documents` (如果存在)
4. ✅ `update_ad_slots_updated_at`
5. ✅ `update_ad_contents_updated_at`
6. ✅ `update_vehicles_updated_at`
7. ✅ `update_service_rating`
8. ✅ `update_service_reviews_updated_at`
9. ✅ `update_question_package_versions_updated_at`
10. ✅ `update_question_ai_answers_updated_at`
11. ✅ `sync_question_tags`
12. ✅ `sync_question_tags_on_insert`
13. ✅ `update_questions_updated_at`
14. ✅ `update_user_profiles_updated_at`
15. ✅ `update_user_interests_updated_at`

**修复方法**: 为所有函数添加 `SET search_path = public`，确保使用固定的搜索路径。

**下一步**: 在数据库中执行迁移脚本。

---

### 2. Vector 扩展在 Public Schema

**状态**: ⚠️ 可选修复（已有迁移脚本）

**问题**: `vector` 扩展安装在 `public` schema 中，建议移到 `extensions` schema。

**修复脚本**: `src/migrations/20251111_move_vector_extension.sql` (已存在)

**注意**: 
- 这是**可选修复**，优先级较低
- 迁移前请确保：
  1. 备份数据库
  2. 在测试环境先验证
  3. 确认所有使用 vector 类型的表和函数正常工作

**下一步**: 可选执行迁移脚本（如果不需要修复，可以忽略此警告）。

---

### 3. Auth 泄露密码保护

**状态**: ⚠️ 需要在 Supabase Dashboard 中配置

**问题**: Supabase Auth 的泄露密码保护功能被禁用。

**说明**: 
- Supabase Auth 可以检查用户密码是否在 HaveIBeenPwned.org 的泄露密码数据库中
- 这是一个安全增强功能，可以防止用户使用已被泄露的密码

**修复方法**: 在 Supabase Dashboard 中启用

**步骤**:
1. 登录 Supabase Dashboard
2. 进入项目设置 (Project Settings)
3. 导航到 **Authentication** → **Password Security**
4. 找到 **Leaked Password Protection** 选项
5. 启用该功能

**参考文档**: 
- https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

**注意**: 
- 此功能需要网络连接到 HaveIBeenPwned.org API
- 启用后，用户注册或更改密码时会检查密码是否已被泄露
- 如果密码在泄露数据库中，注册/更改密码操作将被拒绝

**下一步**: 在 Supabase Dashboard 中手动启用此功能。

---

## ⚡ 性能优化问题

### 1. Multiple Permissive Policies 性能问题

**状态**: ✅ 迁移脚本已创建

**问题**: 多个表存在多个 permissive 策略用于相同的角色和操作（SELECT），导致性能问题。每个策略都需要在每次查询时评估。

**影响评估**:
- ⚠️ **性能影响**: 中等（每个 SELECT 查询需要评估多个策略）
- 📊 **影响范围**: 所有表的 SELECT 操作性能
- 🔧 **修复难度**: 低（只需修改策略定义）

**修复方法**: 将 `service_write` 策略从 `FOR ALL` 改为 `FOR INSERT, UPDATE, DELETE`，排除 SELECT 操作。这样 SELECT 操作只由读策略处理，写操作只由写策略处理，避免策略重叠。

**修复脚本**: `src/migrations/20250122_fix_multiple_permissive_policies_performance.sql`

**修复的表** (19个):
1. `ad_slots`
2. `ad_contents`
3. `ad_logs`
4. `ad_slots_config`
5. `batch_process_tasks`
6. `languages`
7. `question_ai_answer_pending_updates`
8. `question_ai_answers`
9. `question_package_versions`
10. `question_polish_history`
11. `question_polish_reviews`
12. `questions`
13. `service_categories`
14. `service_reviews`
15. `services`
16. `user_interests`
17. `user_profiles`
18. `vehicle_types`
19. `vehicles`

**下一步**: 在数据库中执行迁移脚本。

---

### 2. Duplicate Index 性能问题

**状态**: ✅ 迁移脚本已创建

**问题**: 多个表存在重复的索引，浪费存储空间并可能影响写入性能。

**修复脚本**: `src/migrations/20250122_fix_duplicate_indexes.sql`

**修复的重复索引**:
1. `question_ai_answer_pending_updates`: 删除 `idx_pending_updates_package`，保留 `idx_pending_updates_package_name`
2. `question_ai_answers`: 删除 `idx_question_ai_answers_hash`，保留 `idx_question_ai_answers_question_hash`
3. `question_ai_answers`: 删除 `idx_question_ai_answers_hash_locale_unique`，保留 `question_ai_answers_question_hash_locale_key`
4. `question_package_versions`: 删除 `idx_package_versions_created_at`，保留 `idx_question_package_versions_created_at`
5. `question_package_versions`: 删除 `idx_package_versions_package_name`，保留 `idx_question_package_versions_name`
6. `questions`: 删除 `idx_questions_content_hash_unique`，保留 `questions_content_hash_key`

**下一步**: 在数据库中执行迁移脚本。

---

## 📋 执行顺序

### 安全修复
1. **立即执行**: `20250122_force_fix_function_search_path.sql` - 强制修复函数 search_path 安全问题
   - 如果此脚本执行失败，可以尝试 `20250122_fix_function_search_path.sql`

### 性能优化
2. **立即执行**: `20250122_fix_multiple_permissive_policies_performance.sql` - 修复多个 permissive 策略性能问题
3. **立即执行**: `20250122_fix_duplicate_indexes.sql` - 删除重复索引

### 可选修复
4. **可选执行**: `20251111_move_vector_extension.sql` - 迁移 vector 扩展到 extensions schema

### 手动配置
5. **手动配置**: 在 Supabase Dashboard 中启用泄露密码保护

---

## ✅ 验证修复

### 验证函数 search_path

执行以下 SQL 查询验证所有函数是否已设置 search_path:

```sql
SELECT 
  proname AS function_name,
  prosecdef AS is_security_definer,
  proconfig AS search_path_config
FROM pg_proc
WHERE proname IN (
  'update_services_updated_at',
  'update_ad_content_stats',
  'match_documents',
  'update_ad_slots_updated_at',
  'update_ad_contents_updated_at',
  'update_vehicles_updated_at',
  'update_service_rating',
  'update_service_reviews_updated_at',
  'update_question_package_versions_updated_at',
  'update_question_ai_answers_updated_at',
  'sync_question_tags',
  'sync_question_tags_on_insert',
  'update_questions_updated_at',
  'update_user_profiles_updated_at',
  'update_user_interests_updated_at'
)
ORDER BY proname;
```

**期望结果**: 所有函数的 `proconfig` 应该包含 `search_path=public`

### 验证 vector 扩展位置

```sql
SELECT 
  extname AS extension_name,
  nspname AS schema_name
FROM pg_extension e
JOIN pg_namespace n ON e.extnamespace = n.oid
WHERE extname = 'vector';
```

**期望结果**: `schema_name` 应该是 `extensions`（如果已迁移）或 `public`（如果未迁移）

---

## 📝 注意事项

1. **备份数据库**: 在执行任何迁移脚本之前，请确保已备份数据库
2. **测试环境**: 建议先在测试环境中验证迁移脚本
3. **监控**: 执行迁移后，监控应用程序是否正常工作
4. **回滚计划**: 如果出现问题，准备好回滚方案

---

## 🔗 相关文档

- [Supabase 数据库 Linter 文档](https://supabase.com/docs/guides/database/database-linter)
- [函数 search_path 安全问题](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable)
- [扩展在 public schema 问题](https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public)
- [密码安全配置](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)

