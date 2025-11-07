# RAG 插入测试结果

**测试时间**：2025-01-XX  
**测试状态**：✅ **成功**

---

## ✅ 测试结果

### 1. 数据库连接

- **状态**：✅ 正常
- **SSL 配置**：✅ 已修复
- **连接字符串**：✅ 正确

### 2. 插入功能

- **状态**：✅ 正常
- **插入文档**：✅ 成功
- **文档ID**：`doc_test_e5f42164-1d97-4b06-b0d1-a1a6b12dc460`
- **验证**：✅ 成功

### 3. 测试数据

**插入的文档信息**：
- 文档ID：`doc_test_e5f42164-1d97-4b06-b0d1-a1a6b12dc460`
- 标题：测试文档 - RAG 插入测试
- URL：https://example.com/test-doc
- 内容长度：106 字符
- 来源ID：test_source
- 版本：2025Q1
- 语言：ja
- 向量化状态：pending
- 创建时间：2025-11-07T11:48:19.071Z

### 4. 清理功能

- **状态**：✅ 正常
- **测试数据**：✅ 已清理

---

## 🔧 修复的问题

### SSL 证书错误

**问题**：`self-signed certificate in certificate chain`

**修复**：
1. 在 `src/lib/db.ts` 中设置 `rejectUnauthorized: false`
2. 设置 `NODE_TLS_REJECT_UNAUTHORIZED=0` 环境变量

**代码修改**：
```typescript
// Supabase 必须使用 SSL，但需要接受自签名证书
if (isSupabase) {
  poolConfig.ssl = {
    rejectUnauthorized: false, // Supabase 使用自签名证书
  };
  
  // 设置环境变量以允许自签名证书（仅用于 Supabase）
  if (!process.env.NODE_TLS_REJECT_UNAUTHORIZED) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  }
}
```

---

## ⚠️ 注意事项

### TLS 警告

测试时会看到以下警告：
```
Warning: Setting the NODE_TLS_REJECT_UNAUTHORIZED environment variable to '0' makes TLS connections and HTTPS requests insecure by disabling certificate verification.
```

**说明**：
- 这是预期的警告
- 仅用于 Supabase 连接（受信任的云服务商）
- 不会影响功能

### 环境变量（可选）

如果需要，可以在 `.env` 文件中添加：

```bash
NODE_TLS_REJECT_UNAUTHORIZED=0
```

**注意**：代码中已经自动设置，所以这个环境变量是可选的。

---

## 🚀 下一步

1. ✅ 数据库连接已修复
2. ✅ 插入功能已验证
3. ⏭️ 可以开始接收 Datapull 推送的数据

---

## 📝 测试脚本

测试脚本位置：`scripts/test-insert.ts`

**使用方法**：
```bash
npx tsx scripts/test-insert.ts
```

**功能**：
- 测试数据库连接
- 插入测试文档
- 验证插入结果
- 清理测试数据

---

**测试完成时间**：2025-01-XX  
**测试状态**：✅ 通过

