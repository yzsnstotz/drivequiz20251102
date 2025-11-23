🧩 AI 服务研发规范（ai-service 统一架构规范 v1.0）

版本：v1.0
适用范围：

apps/ai-service（Render 部署版）

apps/local-ai-service（本地 Ollama 调试版）

所有调用 /v1/ask 的前台、后台服务（如 drivequiz-api、admin、web）

Ⅰ. 设计背景与目标

过去多次出现：

local-ai-service 调试正常，但 Render ai-service 出现错误；

两边的 /v1/ask 逻辑不一致，引发 JSON 格式错误、输出空值、response_format 未生效等问题。

根本原因：

ai-service（Render）和 local-ai-service（本地）使用两套不一致的实现逻辑：

不同的 prompt 组装方式

不同的 JSON 输出判断规则

不同的 response_format 参数

不同的解析方式

为了确保未来所有 AI 功能可扩展、可维护、可调试、不会分叉，本规范定义 AI 服务统一架构（Single-Source-of-Truth）。

Ⅱ. 总体架构（Single Pipeline Architecture）

AI 服务必须使用 一条统一的“场景执行管线”（Scene Execution Pipeline），所有逻辑集中在一个模块内：

┌───────────────────────────────┐
│       /v1/ask  (HTTP layer)    │
└──────────────┬────────────────┘
               │
               ▼
┌───────────────────────────────┐
│      runScene()  ← (唯一入口)   │
│  ┌───────────────────────────┐ │
│  │  getSceneConfig()         │ │
│  │  buildMessages()          │ │
│  │  getResponseFormat()      │ │
│  │  callModelWithProvider()  │ │
│  │  tryParseSceneResult()    │ │
│  └───────────────────────────┘ │
└───────────────────────────────┘
               │
               ▼
       返回统一格式 JSON

Ⅲ. 文件结构规范（必须统一）

所有公共逻辑必须放在一个共享文件中，例如：

apps/ai-service/src/lib/sceneRunner.ts


local-ai-service 必须引用同一个文件：

apps/local-ai-service/src/routes/ask.ts
  → import { runScene } from "../../../ai-service/src/lib/sceneRunner";


不允许复制粘贴此文件到 local-ai-service。
不允许在 local 版本单独修改。
不允许在路由内写第二套实现。

Ⅳ. 单一职责原则（SRP: Single Responsibility Principle）
1. /v1/ask 路由职责（只能做薄薄一层）

校验参数

获取 scene、locale、question

调用 runScene()

包装 HTTP 返回值

禁止以下行为：

🚫 不允许路由自行构造 messages
🚫 不允许路由自行拼 prompt
🚫 不允许路由自行调用 OpenAI SDK
🚫 不允许路由添加 response_format
🚫 不允许路由 parse JSON

所有这些都必须交给 runScene()。

2. sceneRunner.ts 的职责（唯一允许修改的核心）
函数	职责
getSceneConfig()	从数据库读取 prompt & outputFormat
buildMessages()	统一构建 messages
getResponseFormatForScene()	判断是否需要 { type: "json_object" }
callModelWithProvider()	同时支持 openai / ollama
tryParseSceneResult()	尝试 JSON.parse
runScene()	所有 AI 调用的唯一入口

未来所有的 prompt / JSON 结构调整
→ 必须修改 sceneRunner.ts，而不是任何路由文件。

Ⅴ. 统一 JSON 处理与 response_format 规则
1. 判断 JSON 场景的唯一规则

来自数据库的：

sceneConfig.outputFormat


只要包含：

"json"

"json_object"

"raw_json"

则必须强制：

response_format: { type: "json_object" }


此规则写死在：

getResponseFormatForScene()


任何相关改动必须修改此函数。

2. JSON 解析统一规则

模型输出的内容必须通过：

tryParseSceneResult()


进行处理：

若 JSON.parse 成功 → json 字段返回对象

若失败 → 仅返回 rawText（降级，但不会中断整体流程）

local-ai-service 和 Render ai-service 必须得到一致结果。

Ⅵ. AI Provider 统一封装

所有模型调用统一走：

callModelWithProvider(providerKind, params)


支持：

providerKind = "openai"

providerKind = "ollama"

Render 与 Local 的唯一区别：

环境	providerKind
Render ai-service	"openai"
local-ai-service	"ollama"

两者不能在路由层随便调用 SDK。
SDK 调用只能出现在 callModelWithProvider 内。

Ⅶ. 修改规则（最重要的部分）

未来任何对 ai-service 的修改必须遵守：

规则 1：全项目只有一条 AI 调用管线

不得新建第二套 scene 执行逻辑，防止再次分叉。

规则 2：local-ai-service 和 ai-service 路由禁止写业务逻辑

只允许：

接收参数

调用 runScene

返回 HTTP 响应

规则 3：任何 prompt、JSON 结构、输出统一从数据库配置读取

即：

ai_scenes.prompt
ai_scenes.outputFormat


AI 逻辑不允许写死在代码中。

规则 4：所有 JSON 格式相关改动必须写在 sceneRunner.ts

如果未来改变 JSON 格式，或输出结构：

必须修改 sceneRunner.ts 中相关函数

严禁直接在路由中“临时 patch”

规则 5：本地调试必须等同于生产实现

local-ai-service = Render ai-service 的镜像行为映射

同样的输入

同样的场景

必须产生完全一致的输出结构

即便模型不同（ollama vs openai），流程必须一致。

规则 6：严格禁止复制文件来“快速修复”

任何复制 sceneRunner.ts 的行为均视为违规并会导致未来 bug 难以发现。

Ⅷ. 发布前自检（CI 可加入）

每次 PR 必须跑以下检查：

🔍 grep 检查不得存在独立调用 SDK 的代码
rg "chat\.completions\.create" apps/ai-service apps/local-ai-service
rg "response_format" apps/ai-service/apps/local-ai-service


必须只出现于：

callModelWithProvider()

🔍 检查是否只存在一个 runScene()
rg "runScene" -n apps


只能存在：

sceneRunner.ts

ask 路由引用

Ⅸ. 返回格式（统一规范）

所有 /v1/ask 返回格式必须一致：

{
  "ok": true,
  "data": {
    "answer": "<string>",
    "json": { ... } | null
  }
}


禁止：

返回不一致字段

输出模型原始结构

输出 choices 或 usage（统一在 server 日志里记录即可）

Ⅹ. 未来扩展（留接口）

未来新增：

多 provider 优先级

回退机制（OpenAI→Ollama）

批量处理

AI 场景链（多个 scene 组合）

均必须建立在 Scene Execution Pipeline 不被破坏 的前提下。

✔️ 最终要求（必须写入团队规范）

从今天起，所有与 AI 相关的新增功能、bugfix、重构，都必须遵守此架构规范。
本规范是全项目的唯一标准，任何成员不得在任何服务自行写第二套逻辑。