# 测试文档

本目录包含 ZALEM 后台管理系统的 API 测试用例。

## 测试框架

- **Vitest**: 测试运行器和断言库
- **测试环境**: Node.js

## 运行测试

```bash
# 运行所有测试
npm test

# 运行测试并显示 UI
npm run test:ui

# 运行测试一次（CI 模式）
npm run test:run

# 运行特定测试文件
npx vitest run tests/api/errors.spec.ts
```

## 测试文件结构

```
tests/
├── api/
│   ├── errors.spec.ts              # 错误工具函数测试（15个测试）
│   ├── pagination.spec.ts           # 分页逻辑测试（22个测试）
│   ├── activate.spec.ts             # 激活接口测试（10个测试）
│   └── admin/
│       └── activation-codes.spec.ts # 激活码管理接口测试（13个测试）
└── README.md                        # 本文档
```

## 测试覆盖范围

### 1. `tests/api/errors.spec.ts` (15个测试)

测试统一错误响应工具函数：

- ✅ `success()` - 成功响应（带/不带分页）
- ✅ `badRequest()` - 400 错误
- ✅ `unauthorized()` - 401 错误
- ✅ `forbidden()` - 403 错误
- ✅ `notFound()` - 404 错误
- ✅ `conflict()` - 409 错误
- ✅ `invalidState()` - 409 状态流转错误
- ✅ `internalError()` - 500 错误

### 2. `tests/api/pagination.spec.ts` (22个测试)

测试分页工具函数：

- ✅ `parsePagination()` - 参数解析（默认值、有效参数、边界值）
- ✅ `getPaginationMeta()` - 分页元信息计算
- ✅ 边界情况处理（total=0、不整除、limit限制等）

### 3. `tests/api/activate.spec.ts` (10个测试)

测试激活接口 (`POST /api/activate`)：

**参数校验**：
- ✅ 缺少 email
- ✅ 缺少 activationCode
- ✅ 无效 email 格式

**激活码校验**：
- ✅ 激活码不存在
- ✅ disabled 状态拒绝
- ✅ suspended 状态拒绝
- ✅ expired 状态拒绝

**业务逻辑**：
- ✅ 过期检查（自动写回 expired 状态）
- ✅ 使用次数超限检查
- ✅ 正常激活流程

### 4. `tests/api/admin/activation-codes.spec.ts` (13个测试)

测试激活码管理接口：

**GET /api/admin/activation-codes**（列表查询）：
- ✅ 默认分页参数
- ✅ status 筛选
- ✅ code 模糊搜索
- ✅ 分页参数
- ✅ sortBy 参数校验
- ✅ 排序功能

**POST /api/admin/activation-codes**（批量生成）：
- ✅ 成功批量生成
- ✅ count 范围校验（1-10000）
- ✅ usageLimit 最小值校验（≥1）
- ✅ status 值校验
- ✅ expiresAt 参数支持
- ✅ 批量生成多个激活码

## 测试统计

- **总测试文件**: 4
- **总测试用例**: 60
- **通过率**: 100%

## Mock 策略

测试使用 Vitest 的 `vi.mock()` 功能来模拟数据库连接和中间件：

- **数据库**: Mock `@/lib/db` 模块
- **管理员鉴权**: Mock `@/app/api/_lib/withAdminAuth` 模块
- **事务**: 模拟 Kysely 事务和查询链

## 注意事项

1. 测试运行在 Node.js 环境中，不依赖真实数据库
2. 所有数据库操作都是 mock 的
3. 测试关注业务逻辑和错误处理，而非数据库实现细节
4. 时间相关的测试使用固定时间值或相对时间

## 持续集成

这些测试可以在 CI/CD 流程中运行：

```yaml
# 示例 GitHub Actions
- name: Run tests
  run: npm run test:run
```

## 添加新测试

添加新测试时，请遵循以下规范：

1. 测试文件命名为 `*.spec.ts`
2. 使用 `describe` 和 `it` 组织测试用例
3. 使用描述性的测试名称（中文或英文）
4. Mock 所有外部依赖
5. 清理 mock 状态（使用 `beforeEach`）

