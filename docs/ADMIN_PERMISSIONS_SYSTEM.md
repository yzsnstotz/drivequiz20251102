# 管理员权限类别管理系统

## 概述

实现了细粒度的管理员权限类别管理系统，允许超级管理员为普通管理员分配不同的权限类别，控制其可以访问的管理页面。

## 功能特性

### 1. 权限类别定义

系统定义了以下权限类别（位于 `src/lib/adminPermissions.ts`）：

- `dashboard` - Dashboard
- `activation_codes` - 激活码管理
- `users` - 用户管理
- `questions` - 题目管理
- `admins` - 管理员管理（仅超级管理员）
- `operation_logs` - 操作日志
- `stats` - 统计
- `tasks` - 任务管理
- `merchants` - 商户管理
- `videos` - 视频管理
- `contact_and_terms` - 联系与条款

### 2. 数据库结构

#### 管理员表 (admins)

添加了 `permissions` 字段（JSONB数组类型）：

```sql
ALTER TABLE admins
ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '[]'::jsonb;

-- 创建索引优化权限查询
CREATE INDEX IF NOT EXISTS idx_admins_permissions ON admins USING GIN (permissions);
```

### 3. API 接口

#### GET /api/admin/me

返回当前登录管理员的权限信息：

```typescript
{
  id: number;
  username: string;
  isActive: boolean;
  isDefaultAdmin: boolean;
  permissions: string[]; // 权限类别数组
}
```

#### GET /api/admin/admins

管理员列表API，返回每个管理员的权限信息。

#### POST /api/admin/admins

创建管理员API，支持传入 `permissions` 数组。

#### PUT /api/admin/admins/:id

更新管理员API，支持更新 `permissions` 字段。

### 4. 前端功能

#### 管理员创建页面 (`/admin/admins`)

- ✅ 创建表单中包含权限类别选择
- ✅ 支持多选权限类别
- ✅ 排除"管理员管理"权限（仅超级管理员可用）

#### 管理员编辑页面 (`/admin/admins/[id]`)

- ✅ 显示当前管理员的权限
- ✅ 支持修改权限类别
- ✅ 权限变更后保存

#### 导航菜单过滤 (`src/app/admin/layout.tsx`)

- ✅ 根据管理员权限动态显示/隐藏菜单项
- ✅ 超级管理员（`username === "admin"`）自动拥有所有权限
- ✅ 普通管理员只显示有权限的菜单项

### 5. 权限检查逻辑

#### 前端权限检查

在 `src/app/admin/layout.tsx` 中：

```typescript
// 根据权限过滤导航项
const NAV_ITEMS = useMemo(() => {
  if (isDefaultAdmin) {
    // 超级管理员，显示所有项
    return ALL_NAV_ITEMS;
  } else {
    // 普通管理员，根据权限过滤
    return ALL_NAV_ITEMS.filter((item) => {
      // 隐藏需要超级管理员权限的项
      if (item.requireDefaultAdmin) {
        return false;
      }
      // 检查权限类别
      if (item.permission && adminPermissions) {
        return adminPermissions.includes(item.permission);
      }
      // 如果没有定义权限，默认显示（向后兼容）
      return true;
    });
  }
}, [isDefaultAdmin, ALL_NAV_ITEMS, adminPermissions]);
```

### 6. 联系信息管理增强

#### 问题修复

- ✅ 为"商务合作"类型添加创建按钮（当不存在时）
- ✅ 为"激活码购买"类型添加创建按钮（当不存在时）
- ✅ 修复了编辑模式下无法选择类型的问题（通过独立的创建按钮解决）

## 使用说明

### 创建管理员并分配权限

1. 超级管理员登录系统
2. 进入"管理员管理"页面（`/admin/admins`）
3. 点击"创建管理员"按钮
4. 填写用户名、Token（可选）、启用状态
5. **勾选权限类别**（可选择多个）
6. 提交创建

### 编辑管理员权限

1. 进入"管理员管理"页面
2. 点击要编辑的管理员ID
3. 在编辑页面中修改权限类别
4. 保存更改

### 权限控制

- **超级管理员**（`username === "admin"`）：
  - 拥有所有权限
  - 可以管理其他管理员
  - 可以分配权限

- **普通管理员**：
  - 只能访问被分配权限的管理页面
  - 无法访问"管理员管理"页面
  - 只能看到有权限的菜单项

## 数据库迁移

运行以下迁移脚本以添加权限字段：

```bash
# 执行迁移
psql -U your_user -d your_database -f src/migrations/20251105_add_admin_permissions.sql
```

或者，如果使用 `init-all-tables.sql`，权限字段会在创建 `admins` 表时自动添加。

## 文件清单

### 新增文件

1. `src/lib/adminPermissions.ts` - 权限类别定义和工具函数
2. `src/migrations/20251105_add_admin_permissions.sql` - 数据库迁移脚本
3. `docs/ADMIN_PERMISSIONS_SYSTEM.md` - 本文档

### 修改文件

1. `src/lib/db.ts` - 添加 `permissions` 字段到 `AdminTable` 接口
2. `src/app/api/admin/me/route.ts` - 返回权限信息
3. `src/app/api/admin/admins/route.ts` - 支持创建时的权限字段
4. `src/app/api/admin/admins/[id]/route.ts` - 支持更新权限字段
5. `src/app/admin/layout.tsx` - 根据权限过滤菜单项
6. `src/app/admin/admins/page.tsx` - 添加权限选择功能
7. `src/app/admin/admins/[id]/page.tsx` - 添加权限编辑功能
8. `src/app/admin/contact-and-terms/page.tsx` - 修复联系信息创建功能

## 注意事项

1. **超级管理员**：用户名必须为 `"admin"`，拥有所有权限，无法通过权限系统限制
2. **权限向后兼容**：如果菜单项没有定义 `permission`，默认显示（向后兼容）
3. **权限验证**：前端菜单过滤仅用于UI展示，后端API仍需要适当的权限检查
4. **权限持久化**：权限以 JSONB 数组格式存储在数据库中，便于查询和扩展

## 后续改进建议

1. 后端API权限检查：在API路由中添加权限检查中间件
2. 权限日志：记录权限变更的操作日志
3. 权限模板：预设权限组合（如"内容管理员"、"运营管理员"等）
4. 细粒度权限：支持更细粒度的权限控制（如"查看"、"编辑"、"删除"）

