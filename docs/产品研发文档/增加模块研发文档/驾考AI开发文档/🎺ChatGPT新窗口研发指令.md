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