
# 🚀 《ZALEM · AI问答模块》启动研发指令

## 🎯 指令目标

在当前项目仓库中，按照以下文档顺序与规则，持续输出完整可运行代码体：

1. 《🧩 ZALEM · AI问答模块 研发文档 v1.0》
2. 《📐 接口与命名规范 v1.0》
3. 《🛠️ ZALEM · AI问答模块 研发规范 v1.0》
4. 《📘 产品文档 v1.0（草案）》
5. 《🏠 当前研发进度与衔接说明 v1.0》

---

## 🧩 执行规则（必须遵守）

### 1️⃣ 输出顺序与文件结构

* 按研发文档与进度说明中列出的顺序（见 `🏠当前研发进度与衔接说明 v1.0`），**一次只输出一个文件**。
* 每次输出内容包含：

  1. 文件路径（绝对路径）
  2. 文件完整代码体（符合 TypeScript / Node / Next.js 标准）
  3. 简短一句话说明文件功能（不超过 1 行）

---

### 2️⃣ 文件创建 / 修改流程

* 如果文件不存在 → **直接创建新文件并输出完整代码体**。
* 如果文件存在 → **先请求现有文件代码体**（说明路径），再输出修改后的完整版本。
* 不允许输出差分代码（必须是完整体）。
* 严禁省略文件路径、函数体或导入语句。

---

### 3️⃣ 开发策略（唯一最优方案）

* 不给出多个选项或方案。
* 自动选择 **性能最高 / 成本最低 / 架构最简** 的实现方式。
* 所有文件按以下顺序执行研发：

```
1️⃣ apps/ai-service/src/index.ts
2️⃣ apps/ai-service/src/routes/ask.ts
3️⃣ apps/ai-service/src/lib/openaiClient.ts
4️⃣ apps/ai-service/src/lib/rag.ts
5️⃣ apps/ai-service/src/lib/cache.ts
6️⃣ apps/ai-service/src/lib/safety.ts
7️⃣ apps/ai-service/src/middlewares/auth.ts
8️⃣ apps/ai-service/src/tasks/dailySummarize.ts
9️⃣ apps/web/app/api/ai/ask/route.ts
🔟 apps/web/app/admin/ai-monitor/page.tsx
```

---

### 4️⃣ 研发输出要求

* 代码须符合：

  * TypeScript 严格模式
  * ESLint + Prettier
  * 所有异步函数必须显式 `try/catch`
  * API 响应结构统一 `{ ok: true|false, data|errorCode|message }`
* 关键函数需附最少注释说明逻辑。
* 遵循以下接口安全约定：

  * 用户端 → JWT 验证
  * 主站 → AI-Service 调用时附 `Service Token`
  * 禁答与内容分类走 `checkSafety()`

---

### 5️⃣ 代码上下文与依赖

* 数据库：Supabase PostgreSQL（pgvector 已启用）
* 模型：GPT-4o-mini（主）+ Ollama（备）
* 环境变量遵循研发文档第八节定义。
* 所有路径与接口命名严格遵循《📐 接口与命名规范 v1.0》。
* 本地运行命令：

  ```bash
  cd apps/ai-service && npm run dev
  cd apps/web && npm run dev
  ```

---

### 6️⃣ 输出停止条件

* 当最后一个文件（`/apps/web/app/admin/ai-monitor/page.tsx`）输出完成后，自动停止。
* 每次文件生成完成后，自动打印一句：

  ```
  ✅ 文件已完成：<文件路径>
  👉 下一步请继续生成：<下一个文件路径>
  ```

---

## 🧠 衔接说明

* ChatGPT 窗口负责研发指令、架构与审查。
* Cursor 窗口负责实际代码编写与文件生成。
* 两端保持完全同步，以《🏠当前研发进度与衔接说明 v1.0》为唯一状态记录源。
* 所有输出必须符合《🛠️ 研发规范 v1.0》和《📐 接口与命名规范 v1.0》。

---

## ✅ 启动命令（复制以下内容到新研发窗口执行）

```
《开始开发》
开始执行《ZALEM · AI问答模块》研发。
请依照《🧩 研发文档 v1.0》和《🏠 当前研发进度与衔接说明 v1.0》的任务顺序，
从第一个文件开始（/apps/ai-service/src/index.ts）输出完整代码体，
严格遵守《📐 接口与命名规范 v1.0》和《🛠️ 研发规范 v1.0》。
每次只输出一个文件的完整实现，并在结尾说明下一步要生成的文件路径。
禁止输出多方案或解释性文字，保持高效研发。
```

----

《续接开发1.0》 - 修复未衔接当前进度的问题
开始执行《ZALEM · AI问答模块》研发续接。
请读取 docs/🏠当前研发进度与衔接说明 v1.0，
从第一个 “未开始(💤)” 或 “开发中(🚧)” 的文件开始继续输出完整代码体。
严格遵守《🧩 研发文档 v1.0》《📐 接口与命名规范 v1.0》《🛠️ 研发规范 v1.0》。
每次仅输出一个完整文件，并在结尾提示下一个文件路径。
禁止输出多方案或解释性文字。

----

《修复报告审核》
<文件路径>在Cursor编译时发生报错，Cursor修复报告如下：

请确认修复没有问题则继续，有问题请提出

----

《续接开发1.1》 - 修复未请求原代码体的问题

🚀 《ZALEM · AI问答模块》启动/衔接统一研发指令（强制先取原代码体）
适用仓库

本仓 Monorepo：/apps/web（主站） + /apps/ai-service（AI服务） + /packages/*

以以下文档为唯一依据：

《🧩 研发文档 v1.0》

《📐 接口与命名规范 v1.0》

《🛠️ 研发规范 v1.0》

《📘 产品文档 v1.0》

《🏠 当前研发进度与衔接说明 v1.2》（下面简称🏠 当前研发进度与衔接说明）

固定研发顺序（仅作为参考序列，实际从续接点继续）
1) apps/ai-service/src/index.ts
2) apps/ai-service/src/routes/ask.ts
3) apps/ai-service/src/lib/openaiClient.ts
4) apps/ai-service/src/lib/rag.ts
5) apps/ai-service/src/lib/cache.ts
6) apps/ai-service/src/lib/safety.ts
7) apps/ai-service/src/middlewares/auth.ts
8) apps/ai-service/src/tasks/dailySummarize.ts
9) apps/web/app/api/ai/ask/route.ts
10) apps/web/app/admin/ai-monitor/page.tsx

执行规则（必须遵守）

读取并解析 🏠 当前研发进度与衔接说明

找到第一个状态为 “💤 未开始” 或 “🚧 开发中” 的具体文件路径，作为当前任务。

先检查文件是否存在：

若存在：先向我索取【该文件原代码体】（明确给出完整路径与文件名）。在我发来原文之前禁止输出替换版本。

若不存在：直接创建并输出完整可运行代码体。

每次只输出一个文件的完整实现（不是差分）。

代码要求：TypeScript 严格模式、ESLint + Prettier、所有异步 try/catch、响应统一 { ok, data|errorCode|message }、遵循鉴权与禁答规则。

输出结尾固定两行：

✅ 文件已完成：<完整路径>
👉 下一步：<下一文件路径>（从进度文档自动识别）


完成一个文件后，提示我去更新 🏠 当前研发进度与衔接说明

本文件 → 标记为 ✅ 已完成

下一个文件 → 标记为 🚧 开发中

不提供多方案；按性能优先、成本最低、架构最简原则直接给出唯一实现。

禁止空谈与无用阐述；只输出代码与必要的一句功能说明。

环境与依赖（引用不赘述）

数据库：Supabase（pgvector）

模型：GPT-4o-mini（主）+ Ollama（备）

所有命名、接口与环境变量严格遵循三份规范文档。

📌 启动命令（复制执行）
开始执行《ZALEM · AI问答模块》研发续接（强制先取原代码体版）。

步骤：
1) 读取《🏠 当前研发进度与衔接说明》，获取第一个状态为“未开始(💤)”或“开发中(🚧)”的具体文件路径，作为当前任务。
2) 若该路径下文件已存在：请先向我发起一次“请求原文件代码体”，必须包含【完整路径 + 文件名】，等待我粘贴原文后，再给出完整替换版。
3) 若该文件不存在：直接创建，输出完整代码体。
4) 代码必须符合：
   - TypeScript 严格模式
   - ESLint + Prettier
   - 统一响应：{ ok, data|errorCode|message }
   - 用户端 JWT 校验；主站→AI-Service 使用 Service Token；禁答走 checkSafety()
5) 仅输出一个文件；末尾打印：
   ✅ 文件已完成：<路径>
   👉 下一步：<下一文件路径>
6) 完成后提醒我更新 🏠 当前研发进度与衔接说明（本文件标记✅；下一个文件标记🚧）。
7) 不得输出多方案或无效阐述。

现在开始第一个续接任务。

----