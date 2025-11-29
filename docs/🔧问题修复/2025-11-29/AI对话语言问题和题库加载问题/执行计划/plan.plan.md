<!-- 85d339a7-7c39-4cf1-8920-921870f951b6 1872a6e6-1605-43d9-8ede-d548522ab608 -->
# AI对话语言问题和题库加载问题修复计划

## 一、规范对齐检查摘要

### 已阅读的规范文件

- AI 服务研发规范（ai-service 统一架构规范 v1.0）
- AI 核心服务规范（ai-core 统一架构规范 v2.0）
- 数据库结构_DRIVEQUIZ.md
- 数据库结构_AI_SERVICE.md
- 文件结构.md
- 修复指令头05版（现用）.md

### 本任务强关联红线条款

- **A1**: 路由层禁止承载业务逻辑（业务逻辑写在 lib / hooks / components 工具函数层）
- **A2**: AI 相关核心逻辑如涉及必须走 ai-core / ai-service 约定，但本任务不改 ai-service / ai-core，只在 web 做兼容与验证
- **B1-B4**: 本次不改任何数据库字段 / 表结构 / 索引；必须确保 Kysely 类型与现有 DB 结构一致
- **B2**: 如新增前端文件，需同步更新 docs/研发规范/文件结构.md
- **D1-D2**: 必须输出执行报告，并逐条标注 A1-D2 的遵守情况

### 本次任务预计影响文件

- `src/components/AIPage.tsx` - 添加语言验证机制和日志
- `src/lib/aiClient.front.ts` - 增强日志记录
- `src/lib/aiClient.server.ts` - 增强日志记录
- `apps/web/app/api/ai/chat/route.ts` - 添加只读日志（不写业务逻辑）
- `src/app/study/learn/page.tsx` - 添加Error Boundary和日志
- `src/app/study/exam/page.tsx` - 添加Error Boundary和日志
- `src/lib/questionsLoader.ts` - 加强加载日志
- `src/lib/imageUtils.ts` - 简化校验逻辑，避免抛错
- `src/lib/version.ts` - 更新版本号
- **新增**: `src/components/StudyErrorBoundary.tsx` - Error Boundary组件
- **新增或修改**: `src/lib/languageDetector.ts` 或 `src/lib/i18n.ts` - 语言检测工具函数

### 明确禁止修改的部分

- `apps/ai-service/**` 以及任何本地 ai-core / local-ai-service 代码
- 任何数据库 schema / migration / Supabase 结构

## 二、任务1：AI对话语言问题修复

### 2.1 加强语言参数日志（链路打通）

**修改文件**: `src/components/AIPage.tsx`

- 在收到AI回复后追加日志，包含：userLanguage、userLocale、requestLang、replyPreview（前80字符）、时间戳
- 位置：在 `handleSend` 函数中，`pushMessage` 添加AI回复消息之后

**修改文件**: `src/lib/aiClient.front.ts`

- 在发送 fetch 前打印结构化日志：tag `[aiClient.front] send`，包含 locale, lang, scene, model, provider
- 在收到响应后打印日志：tag `[aiClient.front] response`，包含 HTTP 状态、lang、响应文本前80字符
- 位置：在 `callAiDirect` 函数中，`fetch` 调用前后

**修改文件**: `src/lib/aiClient.server.ts`

- 做同样的日志处理（如果存在服务端直连 ai-service 的分支），保持前后端日志字段一致
- 位置：在 `callAiServer` 函数中，`fetch` 调用前后

**修改文件**: `apps/web/app/api/ai/chat/route.ts`

- 在从前端 body 解构出 lang / scene 的位置，加一条只读日志：tag `[api/ai/chat] incoming`
- 日志内容包括：lang, scene, model, sourceLanguage, targetLanguage
- **注意**: 按 A1 要求，严禁在 route 中写任何业务判断，只允许读取和 log
- 位置：在 `POST` 函数中，解析 `input` 之后

### 2.2 新增轻量级语言检测工具

**新建文件**: `src/lib/languageDetector.ts`

- 创建 `detectLangFromText` 函数
- 类型定义：`export type DetectedLang = "en" | "zh" | "ja" | "mixed" | "unknown"`
- 实现简单字符集规则：
- 大量 ASCII 字母 && 少量 CJK → "en"
- 大量 CJK（\u4E00-\u9FFF）且几乎无假名 → "zh"
- 存在大量假名（\u3040-\u309F, \u30A0-\u30FF） → "ja"
- 多种字符集混合 → "mixed"
- 太短或无法判断 → "unknown"
- 要求：绝不抛错，对 null/undefined 做防御处理，纯函数无副作用

**同步更新**: `docs/研发规范/文件结构.md` - 添加新文件记录

### 2.3 在AIPage中添加语言验证机制

**修改文件**: `src/components/AIPage.tsx`

- 导入 `detectLangFromText` 函数
- 在收到AI回复文本后，使用 `detectLangFromText(replyText)` 得到 detectedLang
- 与当前用户设置的 `userLanguage` 对比：
- 如果 userLanguage === "en" 且 detectedLang !== "en"
- 或 userLanguage === "zh" 且 detectedLang !== "zh"
- 或 userLanguage === "ja" 且 detectedLang !== "ja"
- 则：打告警日志 `[AIPage] language mismatch`，附上相关字段
- 在UI上以非打断式方式提示用户（在对话框上方增加小的 warning bar）
- 文案示意："AI 回复的语言（检测为: {detectedLang}）可能与当前设置的语言（{userLanguage}）不一致，这可能是外部 AI 服务的行为所致。"
- 不要自动重试，保持行为只读
- 可以预留"反馈"入口（小按钮），但仅打印点击日志
- 位置：在 `handleSend` 函数中，收到AI回复并构建消息之后，显示之前

## 三、任务2：题库无法加载问题修复

### 3.1 新增Study专用Error Boundary

**新建文件**: `src/components/StudyErrorBoundary.tsx`

- 使用 class 组件实现标准 React Error Boundary
- 实现 `componentDidCatch` 和 `getDerivedStateFromError`
- Props: `children: React.ReactNode`，可选 `fallback?: React.ReactNode`
- 默认 fallback 显示："题目加载过程中出现错误，请稍后重试或联系客服。"
- 在 `componentDidCatch` 中使用 `console.error("[StudyErrorBoundary] 捕获到错误", error, info)` 打日志
- 确保该组件以 `"use client"` 开头

**同步更新**: `docs/研发规范/文件结构.md` - 添加新文件记录

### 3.2 用Error Boundary包裹学习/考试页面

**修改文件**: `src/app/study/learn/page.tsx`

- 导入 `StudyErrorBoundary` 组件
- 在 `StudyModePageContent` 组件函数体最开始（在 hooks 之前）添加日志：`console.log("[StudyPage] rendering", { page: "learn", timestamp: new Date().toISOString() })`
- 在 JSX 最外层使用 `<StudyErrorBoundary>` 包裹原有内容
- 如果该 page 是 Server Component，在其返回的顶层 JSX 中用 `<StudyErrorBoundary>` 包裹实际的 Client 组件

**修改文件**: `src/app/study/exam/page.tsx`

- 同样添加渲染日志和 Error Boundary 包裹
- 日志：`console.log("[StudyPage] rendering", { page: "exam", timestamp: new Date().toISOString() })`

### 3.3 简化isValidImageUrl，彻底避免抛错

**修改文件**: `src/lib/imageUtils.ts`

- 将 `isValidImageUrl` 精简为绝不抛错的实现
- 只做这些检查：
- `typeof url === "string"`
- `url.trim().length > 0`
- `url` 以 `http://` / `https://` / `/` 开头之一
- 所有其他情况：返回 `false`，不要抛错
- 用 `try/catch` 包一下，确保任何内部错误都被捕获，返回 `false` 并打一次 `console.warn`（限流）
- 移除所有可能导致抛错的逻辑（如正则炸弹、异步操作等）

### 3.4 加强题目加载日志

**修改文件**: `src/lib/questionsLoader.ts`

- 在 `loadUnifiedQuestionsPackage` 函数开头打印：`console.log("[loadUnifiedQuestionsPackage] start", { timestamp: new Date().toISOString() })`
- 在命中本地缓存分支返回前，加日志：`console.log("[loadUnifiedQuestionsPackage] 使用本地缓存", { version: localVersion, questionCount: cached?.questions?.length ?? 0 })`
- 在走到 `loadFromServer()` 前后也加日志：
- 调用前：`[loadUnifiedQuestionsPackage] no cache, loadFromServer()`
- 调用成功后：`[loadUnifiedQuestionsPackage] loaded from server` + 题目数量
- 捕获异常时：`console.error("[loadUnifiedQuestionsPackage] error", err)`，但不要吞掉错误，交给 Error Boundary 捕获
- **重点**: 不改任何 API URL 或协议字段，保证与现有 BFF / 后端契合

## 四、版本号更新

**修改文件**: `src/lib/version.ts`

- 更新 `BUILD_TIME` 为当前日期时间（格式：YYYY-MM-DD HH:mm:ss）
- 在执行报告摘要中说明当前版本号

## 五、文件结构文档更新

**修改文件**: `docs/研发规范/文件结构.md`

- 如果新增了 `src/components/StudyErrorBoundary.tsx` 或 `src/lib/languageDetector.ts`，必须同步更新对应目录结构
- 更新生成时间和版本号

## 六、执行报告要求

**报告路径**: `docs/问题修复/2025-11-29/AI对话语言问题和题库加载问题/执行报告/ai_language_and_study_loading_执行报告.md`

**报告内容必须包括**:

1. 任务摘要（对应诊断报告的两个问题）
2. 修改文件列表
3. A1-D2 红线规范自检状态
4. 本地测试结果（至少说明：

- AI 对话页面在英文/中文/日文设置下的实际表现与语言验证日志
- `/study/learn` 和 `/study/exam` 页面是否能够正常渲染、是否能打印日志、是否出现 Error Boundary 兜底 UI）

5. 没有数据库/迁移操作的确认说明
6. 版本号说明