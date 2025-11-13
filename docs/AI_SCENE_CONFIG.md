# AI 场景配置功能说明

## 概述

实现了不同 AI 场景配置不同 prompt 和格式的功能，允许在管理后台为不同的使用场景（如首页对话、题目解析等）配置专门的系统 prompt 和输出格式要求。

## 功能特性

### 1. 场景配置管理

- **数据库表**: `ai_scene_config`
- **管理页面**: `/admin/ai/scenes`
- **API 路由**: `/api/admin/ai/scenes`

### 2. 支持的场景

- `chat` - 首页 AI 助手对话框（通用对话）
- `question_explanation` - 驾照页 AI 助手解析题目

### 3. 配置项

每个场景可以配置：
- **场景标识** (`scene_key`) - 唯一标识符，如 `chat`, `question_explanation`
- **场景名称** (`scene_name`) - 显示名称
- **系统 Prompt** - 支持中文、日文、英文三种语言
- **输出格式要求** (`output_format`) - 可选的格式说明
- **最大输出长度** (`max_length`) - 字符数限制
- **温度参数** (`temperature`) - 0.0-2.0，控制回答的随机性
- **启用状态** (`enabled`) - 是否启用此场景配置

## 使用方式

### 1. 在管理后台配置场景

1. 访问 `/admin/ai/scenes`
2. 点击 "新建场景" 或编辑现有场景
3. 填写场景信息：
   - 场景标识（创建后不可修改）
   - 场景名称
   - 中文系统 Prompt（必填）
   - 日文/英文系统 Prompt（可选）
   - 输出格式要求（可选）
   - 最大长度、温度参数等
4. 保存配置

### 2. 前端调用

前端在调用 `/api/ai/ask` 时可以显式指定场景：

```typescript
// 首页 AI 助手对话框
{
  question: "用户问题",
  locale: "zh-CN",
  scene: "chat"  // 显式指定场景
}

// 驾照页题目解析
{
  question: "题目内容...",
  locale: "zh-CN",
  questionHash: "xxx",
  scene: "question_explanation"  // 显式指定场景
}
```

### 3. 自动场景推断

如果前端未指定 `scene` 参数，后端会根据请求自动推断：
- 如果请求中包含 `questionHash`，推断为 `question_explanation` 场景
- 否则使用 `chat` 场景（默认）

## 技术实现

### 数据库结构

```sql
CREATE TABLE ai_scene_config (
  id SERIAL PRIMARY KEY,
  scene_key VARCHAR(64) NOT NULL UNIQUE,
  scene_name VARCHAR(128) NOT NULL,
  system_prompt_zh TEXT NOT NULL,
  system_prompt_ja TEXT,
  system_prompt_en TEXT,
  output_format TEXT,
  max_length INTEGER DEFAULT 1000,
  temperature NUMERIC(3,2) DEFAULT 0.4,
  enabled BOOLEAN DEFAULT TRUE,
  description TEXT,
  updated_by INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 代码修改

1. **`buildSystemPrompt` 函数** (`src/app/api/ai/ask/route.ts`)
   - 支持场景参数
   - 从数据库读取场景配置
   - 根据语言选择对应的 prompt
   - 如果场景配置不存在或未启用，使用默认 prompt（向后兼容）

2. **请求处理** (`src/app/api/ai/ask/route.ts`)
   - 解析请求中的 `scene` 参数
   - 自动推断场景（如果未指定）
   - 在调用 AI 时传递场景信息

3. **前端调用**
   - `QuestionAIDialog.tsx` - 显式指定 `scene: "question_explanation"`
   - `AIPage.tsx` - 显式指定 `scene: "chat"`

## 默认场景配置

系统已预置两个默认场景配置：

### 1. chat（首页 AI 助手对话框）

**中文 Prompt:**
```
你是 ZALEM 驾驶考试学习助手。请基于日本交通法规与题库知识回答用户问题，引用时要简洁，不编造，不输出与驾驶考试无关的内容。如果用户询问驾驶考试相关问题，请基于日本交通法规回答。如果问题与驾驶考试无关，请礼貌地说明你只能回答驾驶考试相关问题。
```

**特点:**
- 最大长度: 1000 字符
- 温度: 0.4
- 支持多轮对话

### 2. question_explanation（驾照页题目解析）

**中文 Prompt:**
```
你是 ZALEM 驾驶考试学习助手。当用户提供完整的题目信息（包括题目、选项、正确答案）时，请：
1. 解释为什么正确答案是正确的
2. 说明其他选项为什么错误（如果有）
3. 引用相关的交通法规或知识点
4. 保持回答简洁，控制在200字以内
5. 如果题目有图片但无法查看，请提示用户描述图片内容以便提供更准确的解析
```

**特点:**
- 最大长度: 500 字符
- 温度: 0.3（更保守，确保准确性）
- 专门针对题目解析优化

## 注意事项

### 1. 场景配置优先级

- 如果场景配置存在且已启用，使用场景配置的 prompt
- 如果场景配置不存在或未启用，使用默认 prompt（向后兼容）

### 2. 语言支持

- 如果场景配置中指定了对应语言的 prompt，使用场景配置的 prompt
- 如果没有对应语言的 prompt，使用中文 prompt 作为后备

### 3. AI Service 调用

目前场景配置主要在主站直接调用 AI 时生效（`openrouter_direct`, `openai_direct` 模式）。

通过 AI Service（Render）的调用暂时使用 AI Service 自己的 `buildSystemPrompt` 函数。如需在 AI Service 中也支持场景配置，需要：
1. 在主站调用 AI Service 时传递 `scene` 参数
2. 修改 AI Service 的 `buildSystemPrompt` 函数支持场景配置
3. 确保 AI Service 可以访问主站数据库（或通过其他方式共享配置）

## 执行步骤

### 1. 执行数据库迁移

```bash
psql $DATABASE_URL -f src/migrations/20251113_create_ai_scene_config.sql
```

### 2. 访问管理后台

1. 登录管理后台
2. 进入 "AI 管理" → "场景配置"
3. 查看或编辑场景配置

### 3. 测试场景配置

1. 在管理后台修改场景的 prompt
2. 在前端测试对应场景的 AI 回答
3. 验证 prompt 是否生效

## 相关文件

- `src/migrations/20251113_create_ai_scene_config.sql` - 数据库迁移脚本
- `src/app/admin/ai/scenes/page.tsx` - 管理后台页面
- `src/app/api/admin/ai/scenes/route.ts` - API 路由
- `src/app/api/ai/ask/route.ts` - AI 调用逻辑（已修改）
- `src/lib/aiDb.ts` - 数据库类型定义（已更新）
- `src/components/QuestionAIDialog.tsx` - 题目解析组件（已更新）
- `src/components/AIPage.tsx` - 首页 AI 助手组件（已更新）

