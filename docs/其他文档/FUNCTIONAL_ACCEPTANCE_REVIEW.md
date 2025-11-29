# 功能验收审查清单与简报

**审查日期**: 2025-01-XX  
**审查范围**: Vercel 生产环境 AI 问答模块  
**审查基准**: 基于生产环境问题报告中的关键问题

---

## 📋 审查清单

### 1. 数据库连接功能验收

#### 1.1 AI 数据库连接配置 ✅❌

**验收项**:
- [ ] Vercel Dashboard 中已配置 `AI_DATABASE_URL` 环境变量（Production 环境）
- [ ] 连接字符串格式正确（DIRECT 连接，端口 5432）
- [ ] 连接字符串包含正确的数据库 ID：`cgpmpfnjzlzbquakmmrj`
- [ ] 连接字符串包含 SSL 配置：`sslmode=require`

**验证方法**:
```bash
# 检查环境变量配置
# 在 Vercel Dashboard → Settings → Environment Variables → Production
# 确认 AI_DATABASE_URL 已配置

# 运行数据库连接测试
NODE_TLS_REJECT_UNAUTHORIZED=0 npx tsx scripts/test-ai-database-connection.ts
```

**预期结果**:
- ✅ 数据库连接成功
- ✅ 找到 7 个 AI 相关表
- ✅ 能够查询 `ai_logs` 表

**当前状态**: ⚠️ **待验证** - 生产环境无法访问数据库

---

#### 1.2 后台日志查询功能 ✅❌

**验收项**:
- [ ] `GET /api/admin/ai/logs` 接口可正常访问
- [ ] 接口返回正确的分页数据
- [ ] 接口支持筛选功能（日期范围、用户ID、语言、模型、搜索关键词）
- [ ] 接口支持 CSV 导出功能
- [ ] 接口返回的数据包含所有必需字段（id, userId, question, answer, locale, model, ragHits, safetyFlag, costEstimate, sources, createdAt）

**验证方法**:
```bash
# 测试日志查询 API
curl -X GET "https://your-domain.vercel.app/api/admin/ai/logs?page=1&limit=10" \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json"

# 测试 CSV 导出
curl -X GET "https://your-domain.vercel.app/api/admin/ai/logs?format=csv" \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json"
```

**预期结果**:
- ✅ 返回状态码 200
- ✅ 返回数据格式符合规范：`{ ok: true, data: { items: [...], pagination: {...} } }`
- ✅ CSV 导出格式正确

**当前状态**: ❌ **失败** - 生产环境无法查询 `ai_logs` 表

---

### 2. JWT 验证功能验收

#### 2.1 JWT Token 读取功能 ✅❌

**验收项**:
- [ ] 支持从 Authorization header 读取 JWT Token（Bearer 格式）
- [ ] 支持从 Cookie 读取 JWT Token（`sb-access-token`）
- [ ] 支持从 query 参数读取 JWT Token（`?token=<jwt>`，仅用于测试）
- [ ] 读取优先级正确：Bearer header > Cookie > query 参数

**验证方法**:
```bash
# 测试 Bearer header 方式
curl -X POST "https://your-domain.vercel.app/api/ai/ask" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"question": "测试问题"}'

# 测试 Cookie 方式（需要浏览器环境）
# 在浏览器控制台设置 Cookie: document.cookie = "sb-access-token=YOUR_JWT_TOKEN"

# 测试 query 参数方式
curl -X POST "https://your-domain.vercel.app/api/ai/ask?token=YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"question": "测试问题"}'
```

**预期结果**:
- ✅ 能够正确读取 JWT Token
- ✅ 能够从 JWT Token 中提取用户 ID

**当前状态**: ⚠️ **待验证** - 无法获取用户 UserId

---

#### 2.2 JWT Token 解析功能 ✅❌

**验收项**:
- [ ] 能够正确解析 JWT Token 的 payload
- [ ] 能够从 payload 中提取用户 ID（支持 `sub`、`user_id`、`userId`、`id` 字段）
- [ ] 能够验证用户 ID 是否为有效的 UUID 格式
- [ ] 如果未配置公钥/密钥，能够降级处理（仅用于开发/预览环境）

**验证方法**:
```javascript
// 在浏览器控制台中解码 JWT Token
const token = "your-jwt-token";
const payload = JSON.parse(atob(token.split('.')[1]));
console.log("JWT Payload:", payload);
// 检查是否包含 sub, user_id, userId 或 id 字段
// 检查用户 ID 是否为有效的 UUID 格式
```

**预期结果**:
- ✅ 能够正确解析 JWT payload
- ✅ 能够提取用户 ID（UUID 格式）
- ✅ 如果用户 ID 不是 UUID 格式，能够正确处理（返回 null 或匿名 ID）

**当前状态**: ❌ **失败** - 无法从 JWT Token 中获取用户 UserId

---

#### 2.3 JWT Token 验证功能 ✅❌

**验收项**:
- [ ] 如果配置了 `USER_JWT_PUBLIC_KEY`（RS256），能够验证 JWT 签名
- [ ] 如果配置了 `USER_JWT_SECRET`（HMAC），能够验证 JWT 签名
- [ ] 如果未配置公钥/密钥，能够降级处理（仅用于开发/预览环境）
- [ ] 生产环境必须配置公钥或密钥

**验证方法**:
```bash
# 检查 Vercel 环境变量配置
# 在 Vercel Dashboard → Settings → Environment Variables → Production
# 确认 USER_JWT_PUBLIC_KEY 或 USER_JWT_SECRET 已配置

# 测试 JWT 验证
curl -X POST "https://your-domain.vercel.app/api/ai/ask" \
  -H "Authorization: Bearer VALID_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"question": "测试问题"}'
```

**预期结果**:
- ✅ 能够验证有效的 JWT Token
- ✅ 能够拒绝无效的 JWT Token（返回 401）
- ✅ 生产环境必须配置公钥或密钥

**当前状态**: ⚠️ **待验证** - 需要确认环境变量配置

---

#### 2.4 用户身份识别功能 ✅❌

**验收项**:
- [ ] 能够正确识别已登录用户（从 JWT Token 中提取 UserId）
- [ ] 能够正确识别匿名用户（无 JWT Token 或 JWT Token 无效）
- [ ] 用户 ID 能够正确传递到 AI Service
- [ ] 用户 ID 能够正确记录到 `ai_logs` 表

**验证方法**:
```bash
# 测试已登录用户
curl -X POST "https://your-domain.vercel.app/api/ai/ask" \
  -H "Authorization: Bearer VALID_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"question": "测试问题"}'

# 检查日志中的 user_id 字段
# 查询数据库: SELECT user_id, question, created_at FROM ai_logs ORDER BY created_at DESC LIMIT 1;
```

**预期结果**:
- ✅ 已登录用户：`user_id` 字段包含有效的 UUID
- ✅ 匿名用户：`user_id` 字段为 null
- ✅ 用户 ID 正确传递到 AI Service

**当前状态**: ❌ **失败** - 无法获取用户 UserId 来区分用户

---

### 3. 核心功能验收

#### 3.1 AI 问答接口 ✅❌

**验收项**:
- [ ] `POST /api/ai/ask` 接口可正常访问
- [ ] 接口支持 JWT 验证（Bearer header、Cookie、query 参数）
- [ ] 接口支持配额限制（10次/天）
- [ ] 接口能够正确转发请求到 AI Service
- [ ] 接口返回正确的响应格式

**验证方法**:
```bash
# 测试问答接口
curl -X POST "https://your-domain.vercel.app/api/ai/ask" \
  -H "Authorization: Bearer USER_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"question": "测试问题", "locale": "zh-CN"}'
```

**预期结果**:
- ✅ 返回状态码 200
- ✅ 返回数据格式：`{ ok: true, data: { answer: "...", sources: [...], model: "...", ... } }`
- ✅ 能够正确识别用户并应用配额限制

**当前状态**: ⚠️ **待验证** - 可能受 JWT 验证问题影响

---

#### 3.2 日志落库功能 ✅❌

**验收项**:
- [ ] 问答请求后能够正确记录到 `ai_logs` 表
- [ ] 日志记录包含所有必需字段（user_id, question, answer, locale, model, rag_hits, safety_flag, cost_est, created_at）
- [ ] 日志记录能够正确区分用户（user_id 字段）

**验证方法**:
```bash
# 发送问答请求
curl -X POST "https://your-domain.vercel.app/api/ai/ask" \
  -H "Authorization: Bearer USER_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"question": "测试问题"}'

# 查询数据库验证日志记录
# SELECT user_id, question, answer, created_at FROM ai_logs ORDER BY created_at DESC LIMIT 1;
```

**预期结果**:
- ✅ 日志记录成功写入 `ai_logs` 表
- ✅ `user_id` 字段包含正确的用户 ID（或 null）
- ✅ 所有字段都正确填充

**当前状态**: ⚠️ **待验证** - 可能受数据库连接和 JWT 验证问题影响

---

### 4. 环境配置验收

#### 4.1 环境变量配置 ✅❌

**验收项**:
- [ ] Vercel Dashboard 中已配置 `AI_DATABASE_URL`（Production 环境）
- [ ] Vercel Dashboard 中已配置 `USER_JWT_PUBLIC_KEY` 或 `USER_JWT_SECRET`（Production 环境）
- [ ] 环境变量格式正确
- [ ] 环境变量已正确注入到运行时环境

**验证方法**:
```bash
# 检查 Vercel Dashboard
# Settings → Environment Variables → Production
# 确认以下环境变量已配置：
# - AI_DATABASE_URL
# - USER_JWT_PUBLIC_KEY 或 USER_JWT_SECRET
```

**预期结果**:
- ✅ 所有必需的环境变量都已配置
- ✅ 环境变量格式正确
- ✅ 环境变量在运行时可用

**当前状态**: ⚠️ **待验证** - 需要确认环境变量配置

---

#### 4.2 数据库状态验收 ✅❌

**验收项**:
- [ ] Supabase 数据库处于活动状态（未暂停）
- [ ] 数据库连接正常
- [ ] 所有必需的表都存在（ai_logs, ai_filters, ai_rag_docs, ai_daily_summary, ai_vectors, ai_config）

**验证方法**:
```bash
# 检查 Supabase Dashboard
# 1. 登录 Supabase Dashboard
# 2. 检查项目状态（是否暂停）
# 3. 如果暂停，需要恢复项目

# 运行数据库连接测试
NODE_TLS_REJECT_UNAUTHORIZED=0 npx tsx scripts/test-ai-database-connection.ts
```

**预期结果**:
- ✅ 数据库处于活动状态
- ✅ 数据库连接成功
- ✅ 所有表都存在

**当前状态**: ⚠️ **待验证** - 需要检查数据库状态

---

## 📊 验收结果简报

### 总体状态

| 功能模块 | 验收项数 | 通过 | 失败 | 待验证 | 状态 |
|---------|---------|------|------|--------|------|
| 数据库连接 | 2 | 0 | 1 | 1 | ❌ **失败** |
| JWT 验证 | 4 | 0 | 1 | 3 | ❌ **失败** |
| 核心功能 | 2 | 0 | 0 | 2 | ⚠️ **待验证** |
| 环境配置 | 2 | 0 | 0 | 2 | ⚠️ **待验证** |
| **总计** | **10** | **0** | **2** | **8** | ❌ **失败** |

---

### 关键问题汇总

#### 🔴 严重问题（阻塞生产）

1. **后台问答日志无法访问数据库**
   - **影响**: 管理员无法在生产环境查看问答日志
   - **原因**: Vercel 生产环境无法连接到 AI 数据库
   - **状态**: ❌ **失败**
   - **优先级**: 🔴 **高**

2. **JWT 实现问题导致无法获取用户 UserId**
   - **影响**: 无法正确识别用户身份，无法按用户维度进行配额限制和日志记录
   - **原因**: 无法从 JWT Token 中提取用户 ID
   - **状态**: ❌ **失败**
   - **优先级**: 🔴 **高**

#### ⚠️ 待验证问题

1. **环境变量配置**
   - **状态**: ⚠️ **待验证**
   - **需要确认**: Vercel Dashboard 中环境变量配置是否正确

2. **数据库状态**
   - **状态**: ⚠️ **待验证**
   - **需要确认**: Supabase 数据库是否处于活动状态

3. **JWT Token 格式**
   - **状态**: ⚠️ **待验证**
   - **需要确认**: JWT Token 的 payload 结构是否正确

---

### 验收通过条件

#### 必须满足的条件

1. ✅ **数据库连接**
   - Vercel 生产环境能够连接到 AI 数据库
   - 后台日志查询接口能够正常返回数据

2. ✅ **JWT 验证**
   - 能够从 JWT Token 中提取用户 ID
   - 能够正确识别已登录用户和匿名用户
   - 用户 ID 能够正确传递到 AI Service 和记录到日志

3. ✅ **环境配置**
   - 所有必需的环境变量都已正确配置
   - 数据库处于活动状态

#### 验收通过标准

- ✅ 所有核心功能验收项通过（8/10）
- ✅ 所有严重问题已解决（2/2）
- ✅ 所有待验证问题已确认（4/4）

---

### 下一步行动

#### 立即行动（高优先级）

1. **检查 Vercel 环境变量配置**
   - [ ] 确认 `AI_DATABASE_URL` 已配置在 Production 环境
   - [ ] 确认 `USER_JWT_PUBLIC_KEY` 或 `USER_JWT_SECRET` 已配置在 Production 环境
   - [ ] 验证连接字符串格式是否正确

2. **检查 Supabase 数据库状态**
   - [ ] 确认数据库处于活动状态（未暂停）
   - [ ] 验证数据库连接是否正常

3. **验证 JWT Token 格式**
   - [ ] 检查前端生成的 JWT Token 的 payload 结构
   - [ ] 确认 payload 中包含 `sub` 字段（用户 ID）
   - [ ] 验证用户 ID 是否为有效的 UUID 格式

#### 后续行动（中优先级）

1. **修复数据库连接问题**
   - [ ] 修复 Vercel 生产环境数据库连接问题
   - [ ] 验证后台日志查询接口能够正常返回数据

2. **修复 JWT 验证问题**
   - [ ] 修复 JWT Token 解析逻辑
   - [ ] 验证能够正确提取用户 ID
   - [ ] 验证用户 ID 能够正确传递和记录

3. **重新运行验收测试**
   - [ ] 运行完整的冒烟测试脚本
   - [ ] 验证所有核心功能正常工作
   - [ ] 生成验收报告

---

### 测试脚本

#### 快速验证脚本

```bash
#!/bin/bash
# 功能验收快速验证脚本

BASE_URL="https://your-domain.vercel.app"
AI_SERVICE_URL="https://your-ai-service.railway.app"
ADMIN_TOKEN="your-admin-token"
USER_TOKEN="your-user-token"

echo "=== 功能验收快速验证 ==="

# 1. 测试数据库连接
echo "1. 测试数据库连接..."
NODE_TLS_REJECT_UNAUTHORIZED=0 npx tsx scripts/test-ai-database-connection.ts

# 2. 测试后台日志查询
echo "2. 测试后台日志查询..."
curl -X GET "$BASE_URL/api/admin/ai/logs?page=1&limit=10" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" | jq .

# 3. 测试 JWT 验证
echo "3. 测试 JWT 验证..."
curl -X POST "$BASE_URL/api/ai/ask" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"question": "测试问题"}' | jq .

# 4. 测试日志落库
echo "4. 测试日志落库..."
# 需要查询数据库验证日志记录
echo "请手动查询数据库验证日志记录: SELECT user_id, question, created_at FROM ai_logs ORDER BY created_at DESC LIMIT 1;"

echo "=== 验证完成 ==="
```

---

## 📝 验收结论

### 当前状态

**验收结果**: ❌ **未通过**

**通过率**: 0% (0/10)

**关键阻塞问题**:
1. 后台问答日志无法访问数据库
2. JWT 实现问题导致无法获取用户 UserId

### 验收建议

1. **立即修复严重问题**
   - 优先解决数据库连接问题
   - 优先解决 JWT 验证问题

2. **验证环境配置**
   - 确认所有环境变量已正确配置
   - 确认数据库状态正常

3. **重新运行验收测试**
   - 修复问题后重新运行完整的验收测试
   - 确保所有功能正常工作

---

**审查完成时间**: 2025-01-XX  
**审查人**: 研发团队  
**下次审查**: 问题修复后重新审查

