# AI Ask API 完整流程步骤清单

本文档列出了 `/api/ai/ask` 接口从请求开始到响应结束的所有执行步骤。

## 流程概览

```
[POST START] → [STEP 0] → [STEP 1] → [STEP 2] → [STEP 3] → [STEP 4] → [STEP 4.5] → [STEP 5] → [STEP 6] → [STEP 7] → [STEP 7.5] → [STEP 8]
```

---

## 详细步骤列表

### [POST START] 请求开始
- **位置**: 函数入口
- **说明**: 记录请求开始时间、URL、方法等信息
- **关键信息**: 生成唯一的 `requestId`

---

### [STEP 0] AI服务选择阶段

#### [STEP 0] 开始选择AI服务
- **说明**: 初始化AI服务选择流程
- **检查项**: 环境变量状态（LOCAL_AI_SERVICE_URL, AI_SERVICE_URL等）

#### [STEP 0.1] URL参数强制模式
- **说明**: 检查URL参数 `?ai=local|online|openai` 是否强制指定模式
- **可能值**: `local` 或 `openai`
- **错误**: URL解析错误

#### [STEP 0.2] 从数据库读取aiProvider配置
- **说明**: 如果URL参数未指定，从数据库 `ai_config` 表读取 `aiProvider` 配置
- **成功**: 数据库配置值（openai/local/openrouter/openrouter_direct/openai_direct）
- **失败**: 数据库配置值无效 / 数据库配置为空或无效 / 数据库读取失败

#### [STEP 0.3] AI服务选择决策
- **说明**: 根据URL参数或数据库配置决定使用哪个AI服务
- **决策逻辑**: URL参数 > 数据库配置
- **错误**: 未获取到 aiProvider 配置（返回500错误）

#### [STEP 0.4] 选择AI服务
- **说明**: 根据决策结果选择具体的AI服务
- **可能路径**:
  - 已选择 OpenAI 服务（回退）
  - 已选择本地AI服务
  - 已选择直连OpenRouter模式（不通过AI Service）
  - 已选择直连OpenAI模式（不通过AI Service）
  - 已选择OpenRouter/OpenAI AI服务
- **错误**: 在线AI服务配置不完整 / 在线AI服务配置也不完整

#### [STEP 0.5] AI服务选择完成
- **说明**: 记录最终选择的AI服务模式、URL等信息

---

### [STEP 1] JWT验证阶段

#### [STEP 1] 开始JWT验证
- **说明**: 开始用户身份验证流程

#### [STEP 1.1] 从Authorization header获取JWT
- **说明**: 从 `Authorization: Bearer <token>` header获取JWT

#### [STEP 1.2] 从Cookie获取JWT
- **说明**: 如果header中没有，尝试从Cookie获取（优先USER_TOKEN，其次sb-access-token）
- **错误**: Cookie读取错误

#### [STEP 1.3] 从Query参数获取JWT
- **说明**: 如果Cookie中也没有，尝试从URL参数 `?token=<jwt>` 获取
- **错误**: URL解析错误

#### [STEP 1.4] 未找到JWT，将使用匿名ID
- **说明**: 如果所有方式都未找到JWT，将使用匿名ID

#### [STEP 1.5] 激活token处理
- **说明**: 检测到激活token格式（act-开头）
- **成功**: 激活token解析成功
- **失败**: 激活token解析失败

#### [STEP 1.6] 标准JWT验证
- **说明**: 验证标准JWT格式的token
- **成功**: JWT验证成功
- **失败**: JWT验证失败 / 生产环境JWT验证失败，返回401

#### [STEP 1.7] 使用匿名ID
- **说明**: 如果没有有效的session，使用匿名ID

#### [STEP 1.8] 会话信息
- **说明**: 记录最终的会话信息（userId、是否匿名）

---

### [STEP 2] 请求体解析与参数校验阶段

#### [STEP 2] 开始解析请求体
- **说明**: 开始解析JSON请求体

#### [STEP 2.1] 请求体解析成功
- **说明**: 成功解析JSON，记录question、locale等信息
- **错误**: 请求体解析失败（返回400错误）

#### [STEP 2.2] 请求体缺少question字段
- **说明**: 检查question字段是否存在
- **错误**: 返回400错误

#### [STEP 2.3] question为空
- **说明**: 检查question是否为空字符串
- **错误**: 返回400错误

#### [STEP 2.4] question过长
- **说明**: 检查question长度是否超过1000字符
- **错误**: 返回400错误

#### [STEP 2.5] locale格式无效
- **说明**: 检查locale是否符合BCP-47格式
- **错误**: 返回400错误

#### [STEP 2.6] 参数校验通过
- **说明**: 所有参数校验通过，记录questionLength、locale、hasQuestionHash
- **关键**: 此时获取 `questionHashFromRequest = body.questionHash?.trim() || null`

---

### [STEP 3] 配额检查阶段

#### [STEP 3] 开始配额检查
- **说明**: 开始检查用户每日配额（10次/日）

#### [STEP 3.1] 配额检查通过（新用户/新日期）
- **说明**: 新用户或新的一天，配额为1

#### [STEP 3.2] 配额已超限
- **说明**: 用户今日配额已用完
- **错误**: 返回429错误（RATE_LIMIT_EXCEEDED）

#### [STEP 3.3] 配额检查通过
- **说明**: 配额未超限，计数+1

---

### [STEP 4] userId转发阶段

#### [STEP 4] 开始处理userId转发
- **说明**: 处理userId转发逻辑

#### [STEP 4.1] 匿名用户，forwardedUserId = null
- **说明**: 匿名用户，forwardedUserId设为null

#### [STEP 4.2] 检测到act-格式，直接使用
- **说明**: act-格式的userId直接使用

#### [STEP 4.3] 直接使用session.userId
- **说明**: UUID格式或其他格式，直接使用

#### [STEP 4.4] userId转发完成
- **说明**: 记录原始userId和转发后的userId

---

### [STEP 4.5] 缓存检查阶段（关键：questionHash处理）

#### [STEP 4.5] 开始检查缓存的AI解析
- **说明**: 检查是否有缓存的AI解析（如果是题目）

#### [STEP 4.5.0] questionHash处理
- **路径1**: 使用前端传递的hash值
  - **说明**: 如果 `questionHashFromRequest` 存在，使用它
  - **关键**: `questionHash = questionHashFromRequest`
- **路径2**: 未传递hash值，将直接调用AI服务生成新解析
  - **说明**: 如果 `questionHashFromRequest` 不存在，`questionHash = null`
  - **关键**: **此时questionHash为null，后续不会写入question_ai_answers表**

#### [STEP 4.5.1] 从数据库中找到AI解析
- **说明**: 如果有questionHash，查询数据库 `question_ai_answers` 表
- **条件**: `questionHash` 存在且数据库中有缓存
- **关键**: 使用 `getAIAnswerFromDb(questionHash, locale)`

#### [STEP 4.5.1.1] 已存入用户缓存（来源：数据库）
- **说明**: 从数据库获取后存入用户内存缓存

#### [STEP 4.5.3] 使用缓存的AI解析，跳过AI服务调用
- **说明**: 如果找到缓存，直接返回，不调用AI服务
- **后续**: 写入日志（STEP 4.5.4）并返回响应

#### [STEP 4.5.4] 写入缓存日志失败
- **说明**: 写入ai_logs表失败（不影响主流程）

#### [STEP 4.5] 检查缓存失败
- **说明**: 缓存检查过程出错（继续调用AI服务，不抛出错误）

---

### [STEP 5] AI服务调用阶段

根据 `aiServiceMode` 的不同，有以下三种路径：

#### 路径A: 直连OpenRouter模式 (openrouter_direct)

##### [STEP 5] 开始直连OpenRouter处理

##### [STEP 5.1] OPENROUTER_API_KEY 未设置
- **错误**: 返回500错误

##### [STEP 5.1.1] API Key 检查
- **说明**: 检查API Key格式、长度、是否有空白字符

##### [STEP 5.2] 读取模型配置失败 / 无法确定直连 OpenRouter 的模型
- **说明**: 从数据库读取模型配置
- **错误**: 无法确定模型（返回500错误）

##### [STEP 5.3] 安全审查未通过
- **说明**: 使用简化版安全审查
- **错误**: 返回403错误

##### [STEP 5.4] RAG 检索已配置，但直连模式下暂时跳过 / RAG 检索失败
- **说明**: RAG检索（直连模式下暂时跳过）

##### [STEP 5.5] 开始调用OpenRouter API
- **说明**: 准备调用OpenRouter API

##### [STEP 5.5.1] OpenRouter Headers 检查
- **说明**: 检查请求头配置

##### [STEP 5.6] OpenRouter API 错误
- **说明**: API调用返回错误状态码

##### [STEP 5.6.1] OpenRouter 401 错误诊断
- **说明**: 详细的401错误诊断信息

##### [STEP 5.7] OpenRouter API 返回空答案
- **错误**: 返回502错误

##### [STEP 5.8] OpenRouter API 调用成功
- **说明**: API调用成功，记录模型、答案长度、token使用量

##### [STEP 5.8.1] 写入 ai_logs 失败
- **说明**: 异步写入ai_logs表失败

##### [STEP 5.8.2] 开始检查并写入 question_ai_answers 表（直连OpenRouter模式）
- **条件**: `questionHash` 存在
- **说明**: 异步写入question_ai_answers表

##### [STEP 5.8.2.1] 数据库已有AI解析，跳过写入（避免覆盖）
- **说明**: 检查到已存在，跳过写入

##### [STEP 5.8.2.2] 成功写入 question_ai_answers 表（新回答）
- **说明**: 成功写入新回答
- **关键**: 使用 `saveAIAnswerToDb(questionHash, answer, locale, model, sources, userId)`

##### [STEP 5.8.2.3] 已存入用户缓存（来源：AI解析）
- **说明**: 存入用户内存缓存

##### [STEP 5.8.2] 写入 question_ai_answers 失败
- **说明**: 写入失败（不影响主流程）

##### [STEP 5.8.2] 异步写入操作失败
- **说明**: 异步操作失败

##### [STEP 5.8.3] 准备返回成功响应（直连OpenRouter模式）
- **说明**: 准备返回响应

##### [STEP 5.9] OpenRouter API 调用失败
- **说明**: API调用过程出错（网络错误、超时等）
- **错误**: 返回502或504错误

---

#### 路径B: 直连OpenAI模式 (openai_direct)

##### [STEP 5] 开始直连OpenAI处理

##### [STEP 5.1] OPENAI_API_KEY 未设置
- **错误**: 返回500错误

##### [STEP 5.1.1] API Key 检查
- **说明**: 检查API Key格式

##### [STEP 5.2] 读取模型配置失败 / 无法确定直连 OpenAI 的模型
- **说明**: 从数据库读取模型配置
- **错误**: 无法确定模型（返回500错误）

##### [STEP 5.3] 安全审查未通过
- **说明**: 使用简化版安全审查
- **错误**: 返回403错误

##### [STEP 5.4] RAG 检索已配置，但直连模式下暂时跳过 / RAG 检索失败
- **说明**: RAG检索（直连模式下暂时跳过）

##### [STEP 5.5] 开始调用OpenAI API
- **说明**: 准备调用OpenAI API

##### [STEP 5.5.1] OpenAI Headers 检查
- **说明**: 检查请求头配置

##### [STEP 5.6] OpenAI API 错误
- **说明**: API调用返回错误状态码

##### [STEP 5.6.1] OpenAI 401 错误诊断
- **说明**: 详细的401错误诊断信息

##### [STEP 5.7] OpenAI API 返回空答案
- **错误**: 返回502错误

##### [STEP 5.8] OpenAI API 调用成功
- **说明**: API调用成功

##### [STEP 5.8.1] 写入 ai_logs 失败
- **说明**: 异步写入ai_logs表失败

##### [STEP 5.8.2] 开始检查并写入 question_ai_answers 表（直连OpenAI模式）
- **条件**: `questionHash` 存在
- **说明**: 异步写入question_ai_answers表

##### [STEP 5.8.2.1] 数据库已有AI解析，跳过写入（避免覆盖）
- **说明**: 检查到已存在，跳过写入

##### [STEP 5.8.2.2] 成功写入 question_ai_answers 表（新回答）
- **说明**: 成功写入新回答

##### [STEP 5.8.2.3] 已存入用户缓存（来源：AI解析）
- **说明**: 存入用户内存缓存

##### [STEP 5.8.2] 写入 question_ai_answers 失败
- **说明**: 写入失败（不影响主流程）

##### [STEP 5.8.2] 异步写入操作失败
- **说明**: 异步操作失败

##### [STEP 5.8.3] 准备返回成功响应（直连OpenAI模式）
- **说明**: 准备返回响应

##### [STEP 5.9] OpenAI API 调用失败
- **说明**: API调用过程出错
- **错误**: 返回502或504错误

---

#### 路径C: 通过AI Service (local/openai/openrouter)

##### [STEP 5] 开始向上游服务发送请求
- **说明**: 准备调用AI Service

##### [STEP 5] AI服务配置不完整
- **错误**: 返回500错误

##### [STEP 5.1] 请求体准备完成
- **说明**: 准备请求体（**注意：请求体中不包含questionHash**）
- **关键**: `requestBody = { userId, locale, question, metadata }`
- **问题**: **questionHash没有传递给AI Service**

##### [STEP 5.2] 开始fetch请求
- **说明**: 开始向上游AI Service发送请求

##### [STEP 5.2] 上游请求完成
- **说明**: 请求完成，记录状态码、耗时

##### [STEP 5.2] 上游请求超时
- **说明**: 请求超时（30秒）
- **错误**: 返回504错误

##### [STEP 5.2] 上游请求网络错误
- **说明**: 网络连接错误（DNS解析失败、连接被拒绝等）

##### [STEP 5.2.1] 本地AI服务失败，尝试回退到在线AI服务
- **说明**: 本地服务失败，尝试回退

##### [STEP 5.2.2] 开始回退请求
- **说明**: 开始回退到在线服务

##### [STEP 5.2.2.1] 回退请求配置
- **说明**: 配置回退请求（90秒超时）

##### [STEP 5.2.3] 回退请求成功 / 回退请求超时 / 回退请求也失败
- **说明**: 回退请求结果

##### [STEP 5.2] 上游请求失败
- **说明**: 其他类型的请求失败
- **错误**: 返回502错误

##### [STEP 5.3] 上游响应文本长度
- **说明**: 读取响应文本

##### [STEP 5.3] 读取上游响应失败
- **错误**: 返回502错误

##### [STEP 5.4] 上游响应解析成功
- **说明**: 成功解析JSON响应

##### [STEP 5.4] 上游响应JSON解析失败
- **错误**: 返回502错误

---

### [STEP 6] 上游响应处理阶段

#### [STEP 6] 开始处理上游响应
- **说明**: 开始处理AI Service返回的响应

#### [STEP 6.1] 上游返回错误
- **说明**: AI Service返回错误响应

#### [STEP 6.1.1] 本地AI服务返回错误，尝试回退到在线AI服务
- **说明**: 本地服务返回502/503/504错误，尝试回退

#### [STEP 6.1.2] 回退到 OpenAI 服务成功 / 回退服务也返回错误 / 回退服务返回错误
- **说明**: 回退请求结果

#### [STEP 6.2] 返回错误响应
- **说明**: 映射错误码并返回错误响应

#### [STEP 6.3] 上游响应成功
- **说明**: 上游响应成功，继续后续处理

---

### [STEP 7] 日志写入阶段

#### [STEP 7] 开始写入 ai_logs 表（备份）
- **说明**: 写入ai_logs表作为备份
- **条件**: `result.ok && result.data && result.data.answer && aiServiceMode !== "local"`

#### [STEP 7] 使用缓存，跳过写入 ai_logs（已在 STEP 4.5.3 中写入）
- **说明**: 如果使用了缓存，跳过写入

#### [STEP 7.1] 写入 ai_logs 失败
- **说明**: 异步写入失败（不影响主流程）

---

### [STEP 7.5] question_ai_answers 表写入阶段（关键：questionHash检查）

#### [STEP 7.5] 开始检查并写入 question_ai_answers 表
- **条件**: `result.ok && result.data && result.data.answer && questionHash`
- **关键**: **只有questionHash存在时才会执行此步骤**
- **问题**: **如果questionHash为null，此步骤会被跳过**

#### [STEP 7.5.1] 数据库已有AI解析（可能是并发请求），跳过写入（避免覆盖）
- **说明**: 检查到已存在，跳过写入
- **检查**: `getAIAnswerFromDb(questionHash, localeStr)`

#### [STEP 7.5.2] 成功写入 question_ai_answers 表（新回答）
- **说明**: 成功写入新回答
- **关键**: 使用 `saveAIAnswerToDb(questionHash, answer, localeStr, model, sources, userId)`

#### [STEP 7.5.2.1] 已存入用户缓存（来源：AI解析）
- **说明**: 存入用户内存缓存

#### [STEP 7.5.2] 写入 question_ai_answers 表返回ID为0，可能写入失败
- **说明**: 写入返回ID为0，可能失败

#### [STEP 7.5.3] 已写入数据库，JSON包需要定期手动更新
- **说明**: 写入成功，记录日志

#### [STEP 7.5] 写入 question_ai_answers 失败
- **说明**: 写入过程出错（不影响主流程）

#### [STEP 7.5] 异步写入操作失败
- **说明**: 异步操作失败

---

### [STEP 8] 返回响应阶段

#### [STEP 8] 准备返回成功响应
- **说明**: 准备返回最终响应

#### [STEP 8.1] 返回成功响应
- **说明**: 返回成功响应，包含answer、sources、model等信息

#### [STEP 7.2] result.ok为false但未在上游处理，返回空数据
- **说明**: 后备处理，返回空数据

---

### [ERROR] 未捕获的异常
- **说明**: 捕获所有未处理的异常
- **错误**: 返回500错误

---

## 关键问题分析

### 问题1: questionHash的获取
- **STEP 2.6**: 从请求体获取 `questionHashFromRequest`
- **STEP 4.5.0**: 
  - 如果存在，使用前端传递的hash值
  - 如果不存在，`questionHash = null`
- **关键**: **代码中没有从数据库questions表查询content_hash的逻辑**

### 问题2: questionHash的传递
- **STEP 5.1** (通过AI Service): 请求体中**不包含questionHash**
- **问题**: **questionHash没有传递给AI Service**

### 问题3: questionHash的丢失
- **STEP 4.5.0**: 如果前端未传递hash，`questionHash = null`
- **STEP 7.5**: 只有`questionHash`存在时才会写入`question_ai_answers`表
- **结果**: **如果questionHash为null，不会写入question_ai_answers表**

---

## 总结

1. **questionHash来源**: 仅从前端请求体获取，不从数据库查询
2. **questionHash传递**: 不传递给AI Service（通过AI Service模式）
3. **questionHash使用**: 仅在写入`question_ai_answers`表时使用，如果为null则跳过写入

