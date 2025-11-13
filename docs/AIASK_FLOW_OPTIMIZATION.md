# AI Ask 流程优化说明

## 修改内容

根据需求，调整了 `/api/ai/ask` 接口的执行流程顺序，确保：
1. 先解析请求体获取hash
2. 先检查缓存，再调用AI服务
3. 确保hash值在正确的条件下匹配

---

## 新的执行流程

### 1. [STEP 1] JWT验证
- 验证用户身份
- 获取userId

### 2. [STEP 2] 解析请求体
- 解析JSON请求体
- **获取 `questionHashFromRequest`**（从请求体的 `questionHash` 字段）
- 校验question、locale等参数

### 3. [STEP 3] 配额检查
- 检查用户每日配额（10次/日）

### 4. [STEP 4] userId转发
- 处理userId转发逻辑

### 5. [STEP 4.5] 缓存检查（关键步骤）

#### 5.1 解析请求体获取hash
- **STEP 4.5.0**: 从请求体获取hash值
  - 如果存在 `questionHashFromRequest`，使用它
  - 如果不存在，`questionHash = null`

#### 5.2 检查内存缓存
- **STEP 4.5.1**: 如果 `questionHash` 存在且 `forwardedUserId` 存在
  - 调用 `getUserCachedAnswer(forwardedUserId, questionHash)`
  - 如果找到，设置 `cacheSource = "memory"`，直接返回

#### 5.3 检查数据库
- **STEP 4.5.2**: 如果内存缓存没有，且 `questionHash` 存在
  - 调用 `getAIAnswerFromDb(questionHash, locale)`
  - 如果找到，设置 `cacheSource = "database"`
  - 存入用户内存缓存（从数据库获取后）

#### 5.4 返回缓存结果
- **STEP 4.5.3**: 如果找到缓存，直接返回，跳过AI服务调用
- **STEP 4.5.4**: 写入日志

#### 5.5 继续流程
- **STEP 4.5.4**: 如果未找到缓存，继续调用AI服务

### 6. [STEP 0] AI服务选择（仅在需要调用AI服务时执行）
- 从数据库读取aiProvider配置
- 选择AI服务模式（local/openai/openrouter/openrouter_direct/openai_direct）
- **注意**: 此步骤现在在缓存检查之后执行

### 7. [STEP 5] 调用AI服务
- 根据选择的模式调用相应的AI服务
- 生成AI回答

### 8. [STEP 6] 处理响应
- 处理AI服务返回的响应

### 9. [STEP 7] 写入日志
- 写入 `ai_logs` 表

### 10. [STEP 7.5] 写入question_ai_answers表
- **条件**: `questionHash` 存在
- 检查是否已存在（防止重复写入）
- 写入新回答到 `question_ai_answers` 表
- 存入用户内存缓存

### 11. [STEP 8] 返回响应
- 返回最终结果

---

## 关键改进点

### 1. 流程顺序优化
- ✅ **之前**: AI服务选择在缓存检查之前执行
- ✅ **现在**: AI服务选择在缓存检查之后执行（只有在需要调用AI服务时才执行）

### 2. 缓存检查逻辑优化
- ✅ **之前**: 只检查数据库
- ✅ **现在**: 先检查内存缓存，再检查数据库
  - 内存缓存：`getUserCachedAnswer(userId, questionHash)`
  - 数据库：`getAIAnswerFromDb(questionHash, locale)`

### 3. questionHash处理逻辑
- ✅ **STEP 4.5.0**: 从请求体获取hash值
- ✅ **STEP 4.5.1**: 使用hash检查内存缓存
- ✅ **STEP 4.5.2**: 使用hash检查数据库
- ✅ **STEP 7.5**: 使用hash写入question_ai_answers表

### 4. 缓存来源标识
- ✅ **memory**: 从内存缓存获取
- ✅ **database**: 从数据库获取
- ✅ 在返回响应中标识缓存来源

---

## 执行流程图

```
请求开始
  ↓
[STEP 1] JWT验证
  ↓
[STEP 2] 解析请求体 → 获取questionHash
  ↓
[STEP 3] 配额检查
  ↓
[STEP 4] userId转发
  ↓
[STEP 4.5] 缓存检查
  ├─ [4.5.0] 获取hash值
  ├─ [4.5.1] 检查内存缓存 → 找到？返回
  ├─ [4.5.2] 检查数据库 → 找到？返回
  └─ [4.5.4] 未找到，继续
  ↓
[STEP 0] AI服务选择（仅在需要时执行）
  ↓
[STEP 5] 调用AI服务
  ↓
[STEP 6] 处理响应
  ↓
[STEP 7] 写入日志
  ↓
[STEP 7.5] 写入question_ai_answers表（如果questionHash存在）
  ↓
[STEP 8] 返回响应
```

---

## 验证要点

1. ✅ 请求体的hash值正确获取
2. ✅ 内存缓存优先检查
3. ✅ 数据库缓存作为后备
4. ✅ AI服务选择在缓存检查之后
5. ✅ questionHash在写入question_ai_answers表时存在
6. ✅ 缓存来源正确标识

---

## 注意事项

1. **questionHash为null的情况**:
   - 如果前端未传递hash，`questionHash = null`
   - 此时不会写入 `question_ai_answers` 表
   - 这是预期行为（非题目请求）

2. **内存缓存**:
   - 使用 `getUserCachedAnswer(userId, questionHash)` 检查
   - 使用 `setUserCachedAnswer(userId, questionHash, answer)` 存储
   - 每个用户最多缓存1000条

3. **数据库缓存**:
   - 使用 `getAIAnswerFromDb(questionHash, locale)` 查询
   - 从数据库获取后会自动存入内存缓存

4. **写入question_ai_answers表**:
   - 只有在 `questionHash` 存在时才会写入
   - 写入前会检查是否已存在（防止重复写入）

