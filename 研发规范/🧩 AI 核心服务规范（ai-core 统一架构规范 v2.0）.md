🧩 AI 核心服务规范（ai-core 统一架构规范 v2.0）

版本：v2.0
状态：正式发布（Current Standard）
适用范围：

apps/ai-service（Render 部署的在线模型服务）

apps/local-ai-service（本地 Ollama 调试服务）

所有调用 /v1/ask 的服务（drivequiz-api / web / admin）

AI 相关未来新服务（批处理器、翻译器、RAG 服务等）

0. 修订背景

在 v1.0 版本中，我们将 local-ai-service 与 ai-service 的 AI 调用逻辑统一到了 sceneRunner.ts。
但在工程化层面仍存在问题：

跨 app 相对路径引用 → 脆弱且难以维护

类型退化为 any → 易引发运行时问题

OpenAI / Ollama provider 封装耦合到 ai-service 内部

两个服务对 Config 的依赖边界不明确

为保证未来大规模扩展（批处理、模型优先级、自动回退、本地缓存等），需要进一步提升架构稳定性。

因此推出 v2.0：ai-core 统一架构规范。

1. 架构总览（Single AI Pipeline Architecture）

所有 AI 场景执行必须使用 一条统一的调用管线，由 shared package 管理：

packages/ai-core
 ├─ src/
 │   ├─ sceneRunner.ts      ← AI 调用唯一入口（主逻辑）
 │   ├─ providers/
 │   │   ├─ openaiClient.ts ← OpenAI 封装
 │   │   ├─ ollamaClient.ts ← Ollama 封装
 │   ├─ types.ts            ← 核心类型定义
 │   ├─ utils.ts            ← 公共工具方法（可选）
 │
 ├─ package.json
 └─ index.ts


两个服务引用：

apps/ai-service/src/routes/ask.ts
   → import { runScene } from "@zalem/ai-core"

apps/local-ai-service/src/routes/ask.ts
   → import { runScene } from "@zalem/ai-core"


所有调用都只能通过 runScene() 进入 AI 逻辑。
禁止任何服务自行实现 AI 调用、JSON 构造、response_format 等内容。

2. 目录结构（必须遵循）
packages/ai-core/
  ├─ src/
  │   ├─ types.ts
  │   ├─ sceneRunner.ts
  │   ├─ utils.ts
  │   └─ providers/
  │       ├─ openaiClient.ts
  │       └─ ollamaClient.ts
  └─ index.ts

2.1 index.ts（统一导出）
export * from "./src/types";
export * from "./src/sceneRunner";


apps 引用方式：

import { runScene, AiServiceConfig } from "@zalem/ai-core";

3. 核心模块说明
3.1 types.ts（强类型定义）
export interface AiServiceConfig {
  model: string;
  openaiApiKey?: string;     // 仅 openai provider 必需
  ollamaUrl?: string;        // 仅 ollama provider 必需

  userPrefix: string;
  refPrefix: string;
}

export interface SceneConfig {
  prompt: string;
  outputFormat: string | null;
}

export interface RunSceneOptions {
  sceneKey: string;
  locale: string;
  question: string;
  reference?: string | null;

  providerKind: "openai" | "ollama";
  config: AiServiceConfig;
}

export interface SceneResult {
  rawText: string;
  json: any | null;
}


❗禁止使用 any；必须全部使用上述类型。

3.2 sceneRunner.ts（AI 调用唯一入口）

需要包含：

getSceneConfig()（从数据库读取 prompt + outputFormat）

buildMessages()（统一构建 system/user messages）

getResponseFormatForScene()（判断是否启用 JSON 模式）

callModelWithProvider()（封装 OpenAI + Ollama）

tryParseSceneResult()（统一 JSON.parse）

runScene()（全项目唯一 AI 执行入口）

所有未来修改必须在此文件完成。

所有服务调用方式统一：

const result = await runScene({
  sceneKey: scene,
  locale: locale,
  question,
  reference,
  providerKind: "openai",       // Render
  config,
});


或：

providerKind: "ollama"          // Local

4. Provider 封装规范
4.1 openaiClient.ts

职责：

负责创建 OpenAI SDK 客户端实例

负责处理 response_format

负责统一的 tokens 提取

禁止导入 ai-service 内部的模块（如 ServiceConfig）

接口：

export async function callOpenAI({
  model,
  messages,
  responseFormat,
  apiKey,
}: {
  model: string;
  messages: any[];
  responseFormat?: { type: "json_object" };
  apiKey: string;
}): Promise<string>;

4.2 ollamaClient.ts

职责：

封装 Ollama API 调用

不允许传递 OpenAI 风格的参数

负责兼容旧版与新版 Ollama 输出结构

接口：

export async function callOllama({
  model,
  messages,
  url,
}: {
  model: string;
  messages: any[];
  url: string;
}): Promise<string>;

5. JSON 输出规范
5.1 统一规则（必须写死在 sceneRunner 内）
if (outputFormat.includes("json")) {
    response_format = { type: "json_object" };
}

5.2 返回格式必须统一
{
  "ok": true,
  "data": {
    "answer": "<rawText>",
    "json": { ... } | null
  }
}


禁止：

返回 OpenAI 原始结构

返回 choices

返回 usage

返回 model 信息

（这些信息统一在服务日志里记录。）

6. /v1/ask 路由规范（强制统一）

每个服务（local / render）中的 /v1/ask 路由必须遵循：

6.1 允许做的：

✔ 参数校验
✔ 从数据库加载 scene key、locale、question、reference
✔ 调用 runScene()
✔ 返回 HTTP 响应结构

6.2 禁止（违反规范即算分叉）：

🚫 不允许直接调用 OpenAI SDK
🚫 不允许直接调用 Ollama API
🚫 不允许自行构造 response_format
🚫 不允许自行 parse JSON
🚫 不允许调整 prompt
🚫 不允许构造 messages
🚫 不允许从路由层读取 outputFormat
🚫 不允许在路由层做 provider fallback
🚫 不允许在路由层做 model 选择

所有这些逻辑必须在 packages/ai-core/sceneRunner.ts 内。

7. Config 边界规范

每个服务必须实现 AiServiceConfig：

const config: AiServiceConfig = {
  model: process.env.MODEL,
  openaiApiKey: process.env.OPENAI_KEY,
  ollamaUrl: process.env.OLLAMA_URL,

  userPrefix: "User:",
  refPrefix: "Reference:",
};

必须保证：

ai-service（render）必须设置 openaiApiKey

local-ai-service 必须设置 ollamaUrl

两者都必须设置 model/userPrefix/refPrefix

任何其他内部字段不得加入 AiServiceConfig 中

AiServiceConfig 必须保持透明、轻量、稳定。

8. 错误处理规范

对于任何错误（OpenAI/Ollama 失败、DB 读取失败、JSON 解析失败等）：

返回统一结构：

{
  "ok": false,
  "error": {
    "message": "...",
    "code": "AI_SERVICE_ERROR",
    "provider": "openai | ollama"
  }
}


错误结构不得与 local / remote 产生差异。

9. 自检（CI 规范）

每次提交必须运行以下检查。

9.1 禁止重复 AI 实现（必须 0 结果）
rg "chat\.completions\.create" apps
rg "ollama" apps              # 除 providers/ollamaClient.ts 外必须 0 结果
rg "response_format" apps/    # 除 sceneRunner.ts 外必须 0 结果

9.2 禁止跨 app 相对路径
rg "\.\./\.\./\.\./ai-service" -n


结果必须为 0。

9.3 路由内禁止出现 AI 逻辑
rg "new OpenAI" apps
rg "JSON.parse" apps          # 除 sceneRunner.ts 必须为 0

10. 回归测试规范（自动化 or 手动）

同一输入：

打向 local-ai-service /v1/ask

打向 ai-service（Render） /v1/ask

两者必须：

ok: true

data.answer 非空

对于 JSON 场景：

data.json 必须是 object（非 null）

若任何不一致 → 视为违反规范。

11. 未来扩展点（必须以 ai-core 为中心）

未来所有新功能必须在 ai-core 扩展：

功能	必须放在 ai-core
多 Provider 优先级	✔
Provider 自动回退	✔
批量处理	✔
Prompt 模版系统	✔
统一缓存	✔
统一 tokens 计数策略	✔
RAG 统一整合	✔

任何放在 ai-service 或 local-ai-service 内部的 Provider 逻辑都违反规范。

✔ 最终声明（必须写入规范）

自本规范发布后，所有 AI 相关逻辑只能修改 packages/ai-core。
ai-service 与 local-ai-service 不得自行编写 AI 逻辑，不得分叉，不得绕过 runScene。
任何违反此规范的代码均视为架构违规。