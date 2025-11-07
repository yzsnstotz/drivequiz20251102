# DriveQuiz API 401 认证失败问题排查结果

**排查时间**：2025-11-07  
**排查状态**：✅ 已定位问题

---

## 📋 排查结果

### ✅ 检查项 1：服务端环境变量配置

**结果**：✅ 已配置

```bash
DRIVEQUIZ_API_TOKEN_SECRET=drivequiz-api-secret-token-1762510925
```

**位置**：`apps/drivequiz-api/.env`

---

### ❌ 检查项 2：Token 值匹配验证

**结果**：❌ **Token 值不匹配**

| 项目 | 值 | 长度 |
|------|-----|------|
| **客户端发送的 Token** | `datapull_drivequiz_api_token_2025_secure_key_v1` | 47 字符 |
| **服务端期望的 Token** | `drivequiz-api-secret-token-1762510925` | 37 字符 |
| **是否匹配** | ❌ **false** | - |

**问题分析**：
- 客户端发送的 Token 与服务端配置的 Token **完全不同**
- 这是导致 401 认证失败的**根本原因**

---

### ✅ 检查项 3：服务端运行状态

**结果**：✅ 服务正在运行

- **健康检查**：`http://localhost:8789/api/v1/rag/health` ✅ 正常响应
- **端口状态**：8789 端口已被占用（进程 ID: 43796）
- **服务版本**：v1.1

---

## 🎯 问题根本原因

**Token 值不匹配**：
- 客户端（datapull）发送的 Token：`datapull_drivequiz_api_token_2025_secure_key_v1`
- 服务端（drivequiz-api）期望的 Token：`drivequiz-api-secret-token-1762510925`
- 两个 Token 值完全不同，导致所有请求返回 401

---

## ✅ 解决方案

### 方案 1：更新服务端 Token 值（推荐）

**步骤**：

1. **更新 `.env` 文件**：
   ```bash
   cd apps/drivequiz-api
   # 备份当前配置
   cp .env .env.backup
   
   # 更新 Token 值
   sed -i '' 's/DRIVEQUIZ_API_TOKEN_SECRET=.*/DRIVEQUIZ_API_TOKEN_SECRET=datapull_drivequiz_api_token_2025_secure_key_v1/' .env
   ```

2. **验证更新**：
   ```bash
   grep DRIVEQUIZ_API_TOKEN_SECRET .env
   ```

3. **重启服务**：
   ```bash
   # 停止当前服务（进程 ID: 43796）
   kill 43796
   
   # 重新启动服务
   npm run dev
   ```

4. **验证修复**：
   ```bash
   curl -X POST http://localhost:8789/api/v1/rag/docs/batch \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer datapull_drivequiz_api_token_2025_secure_key_v1" \
     -d '{"docs":[],"sourceId":"test"}'
   ```

### 方案 2：更新客户端 Token 值

如果服务端的 Token 值是正确的，则需要更新客户端（datapull）的 Token 值：

```bash
# 在 datapull 服务中更新环境变量
DRIVEQUIZ_API_TOKEN=drivequiz-api-secret-token-1762510925
```

---

## 📝 建议

### 1. 统一 Token 管理

建议在联调文档中明确：
- 服务端和客户端使用**相同的 Token 值**
- Token 值应该通过**安全的方式**共享（如密钥管理服务）
- 避免在代码中硬编码 Token

### 2. 改进错误信息

建议在服务端添加更详细的认证日志：
- 记录接收到的 Token（脱敏处理）
- 记录 Token 比较结果
- 区分"未配置密钥"和"token 不匹配"两种情况

### 3. 增强健壮性

建议改进 Token 验证逻辑：
- 添加 `trim()` 处理，避免空格问题
- 支持多个 Token（白名单机制）
- 提供更明确的错误提示

---

## 🔗 相关文件

- `apps/drivequiz-api/.env` - 环境变量配置
- `apps/drivequiz-api/src/utils/auth.ts` - 认证逻辑
- `apps/drivequiz-api/401_AUTH_ISSUE_ANALYSIS.md` - 详细排查报告

---

## ✅ 下一步行动

1. **立即修复**：更新服务端 Token 值以匹配客户端
2. **验证修复**：使用 curl 测试批量上传接口
3. **通知 datapull 团队**：确认 Token 值已更新，可以重新测试

---

**排查完成时间**：2025-11-07  
**问题状态**：✅ 已定位，待修复

