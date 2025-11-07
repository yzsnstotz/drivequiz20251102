# RAG 文档插入流程说明

## ✅ 确认：直接插入不会创建 operation 记录

**是的，直接插入到 `rag_documents` 表不会创建 operation 相关记录。**

---

## 📊 数据表关系

### 三个表的关系

1. **`rag_operations`** - 操作记录表
   - 记录每次上传操作（单文档或批量）
   - 包含操作ID、来源ID、状态、文档数等

2. **`rag_documents`** - 文档表
   - 存储文档分片内容
   - 包含文档ID、标题、URL、内容等

3. **`rag_operation_documents`** - 操作文档映射表
   - 关联操作和文档
   - 记录每个文档的上传状态

### 关系图

```
rag_operations (操作记录)
    ↓ (1:N)
rag_operation_documents (操作文档映射)
    ↓ (N:1)
rag_documents (文档)
```

---

## 🔄 完整插入流程

### 正常流程（通过 API）

当 Datapull 通过 API 上传文档时，会执行以下步骤：

1. **创建操作记录** (`rag_operations`)
   ```typescript
   await createOperation(operationId, sourceId, docsCount, metadata);
   ```

2. **插入文档** (`rag_documents`)
   ```typescript
   await db.insertInto("rag_documents").values(doc).execute();
   ```

3. **记录操作文档映射** (`rag_operation_documents`)
   ```typescript
   await logOperationDocument(operationId, docId, "success");
   ```

4. **更新操作状态** (`rag_operations`)
   ```typescript
   await updateOperationStatus(operationId, "success");
   ```

### 直接插入（跳过 operation）

如果直接插入到 `rag_documents` 表：

```typescript
// 只插入文档，不创建操作记录
await db.insertInto("rag_documents").values(doc).execute();
```

**结果**：
- ✅ `rag_documents` 表有数据
- ❌ `rag_operations` 表没有数据
- ❌ `rag_operation_documents` 表没有数据

---

## 🧪 测试脚本对比

### 1. 直接插入（test-insert-keep.ts）

**功能**：只插入文档到 `rag_documents` 表

**结果**：
- ✅ `rag_documents` 表有数据
- ❌ `rag_operations` 表没有数据
- ❌ `rag_operation_documents` 表没有数据

**使用场景**：测试数据库连接和插入功能

### 2. 完整流程（test-full-flow.ts）

**功能**：模拟完整的插入流程

**结果**：
- ✅ `rag_documents` 表有数据
- ✅ `rag_operations` 表有数据
- ✅ `rag_operation_documents` 表有数据

**使用场景**：测试完整的业务流程

---

## 📋 代码位置

### 单文档上传流程

**文件**：`src/routes/docs.ts`

**流程**：
```typescript
// 1. 创建操作记录
await createOperation(operationId, input.meta.sourceId, 1, {
  version: input.version,
  lang: input.lang,
});

// 2. 插入文档
await db.insertInto("rag_documents").values({...}).execute();

// 3. 记录操作文档映射
await logOperationDocument(operationId, docId, "success");

// 4. 更新操作状态
await updateOperationStatus(operationId, "success");
```

### 批量上传流程

**文件**：`src/routes/docs-batch.ts`

**流程**：
```typescript
// 1. 创建操作记录
await createOperation(operationId, body.sourceId, body.docs.length, {...});

// 2. 并发处理每个文档
for (const doc of body.docs) {
  // 插入文档
  await db.insertInto("rag_documents").values({...}).execute();
  
  // 记录操作文档映射
  await logOperationDocument(operationId, docId, "success");
}

// 3. 更新操作状态
await updateOperationStatus(operationId, finalStatus, failed);
```

---

## ✅ 测试结果

### 完整流程测试

**测试脚本**：`scripts/test-full-flow.ts`

**测试结果**：
- ✅ 操作记录创建成功
- ✅ 文档插入成功
- ✅ 操作文档映射记录成功
- ✅ 操作状态更新成功

**验证结果**：
- ✅ `rag_operations` 表：1 条记录
- ✅ `rag_documents` 表：2 条记录（包含之前的测试数据）
- ✅ `rag_operation_documents` 表：1 条记录

---

## 💡 建议

### 1. 测试数据库连接

使用 `test-insert-keep.ts`：
```bash
NODE_TLS_REJECT_UNAUTHORIZED=0 npx tsx scripts/test-insert-keep.ts
```

### 2. 测试完整流程

使用 `test-full-flow.ts`：
```bash
NODE_TLS_REJECT_UNAUTHORIZED=0 npx tsx scripts/test-full-flow.ts
```

### 3. 查询验证

使用 `test-query.ts`：
```bash
NODE_TLS_REJECT_UNAUTHORIZED=0 npx tsx scripts/test-query.ts
```

---

## 📝 总结

1. **直接插入**：只会在 `rag_documents` 表中创建记录
2. **完整流程**：会在三个表中都创建记录
3. **正常使用**：通过 API 上传会自动执行完整流程
4. **测试目的**：直接插入用于测试数据库连接，完整流程用于测试业务逻辑

---

**最后更新**：2025-01-XX

