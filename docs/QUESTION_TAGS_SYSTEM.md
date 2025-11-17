# 题目标签系统统一规范

## 概述

题目标签系统包含三个独立的维度，用于对题目进行分类和标记：

1. **license_type_tag**：驾照类型（单个值）
2. **stage_tag**：考试阶段（单个值）
3. **topic_tags**：知识主题（数组，1-2个）

⚠️ **重要**：这三个维度是互相独立的，不要混用。

## 1. license_type_tag（驾照类型）

### 定义

`license_type_tag` 是一个**数组**，可以包含一个或多个驾照类型，表示题目适用的驾照类型。

### 可选值

| 值 | 说明 | 日文 |
|---|---|---|
| `ordinary` | 普通免許 | 普通免許 |
| `semi_medium` | 準中型免許 | 準中型免許 |
| `medium` | 中型免許 | 中型免許 |
| `large` | 大型免許 | 大型免許 |
| `moped` | 原付（原動機付自転車） | 原付 |
| `motorcycle_std` | 普通二輪 | 普通二輪 |
| `motorcycle_large` | 大型二輪 | 大型二輪 |
| `ordinary_2` | 普通二種 | 普通二種 |
| `medium_2` | 中型二種 | 中型二種 |
| `large_2` | 大型二種 | 大型二種 |
| `trailer` | けん引 | けん引 |
| `large_special` | 大型特殊 | 大型特殊 |
| `foreign_exchange` | 外国免許切替相关题目 | 外国免許切替 |
| `reacquire` | 再取得試験特有题目 | 再取得 |
| `provisional_only` | 仅仮免阶段会出现的题目 | 仮免のみ |
| `common_all` | 所有驾照类型都需要掌握的基础题目 | 共通 |

### 选择规则

1. 如果题目是纯粹的交通规则通用内容（信号灯、停止线、基础让行规则、一般道路标志等），使用 `["common_all"]`。
2. 如果题目明显只针对某种车辆：
   - 出现「原動機付自転車」「原付」相关 → 使用 `moped`
   - 出现「自動二輪車」「二輪車」且内容与二輪特性相关 → 使用 `motorcycle_std` 或 `motorcycle_large`
   - 出现「大型貨物自動車」「車両総重量」「最大積載量」等 → 使用 `large` 或 `medium`
   - 出现「普通自動車」「乗用車」且与乘用车特性相关 → 使用 `ordinary`
   - 出现「旅客自動車」「乗合バス」「タクシー」且与乘客安全、营运规范相关 → 使用 `ordinary_2`、`medium_2` 或 `large_2`
   - 出现工程车、特殊作业车相关 → 使用 `large_special`
3. 不要同时使用多个具体驾照标签，如果适用多个，请改用 `common_all`。

## 2. stage_tag（考试阶段）

### 定义

`stage_tag` 是一个**单个值**，表示题目适用于哪个考试阶段。

### 可选值

| 值 | 说明 | 日文 |
|---|---|---|
| `provisional` | 仮免阶段的练习或考试题目 | 仮免 |
| `full` | 本免阶段 | 本免 |
| `both` | 仮免和本免都考的共通题 | 両方 |

### 判定规则

1. **仮免 (provisional)** 通常考：
   - 基础交通规则：信号灯、停止线、基本让行顺序
   - 简单交通标志：速度限制、停车禁止、进出禁止等
   - 基本行人与车辆关系
   - 基础安全驾驶知识（例如保持车距的概念）

2. **本免 (full)** 主要包含：
   - 高速道路的合流、加速车道、服务区和车道规则
   - 二輪独特的技术题（车体倾斜、复杂制动、弯道技巧等）
   - 大型货车特有的盲区、内轮差、货物固定、高级装载规则等
   - 二種（客运）特有的服务规范、乘客上下车安全、营运责任
   - 特殊车辆（工程车）操作相关

3. **共通 (both)**：
   - 如果题目属于相当基础的交通规则，且在仮免与本免中都可能出现，使用 `both`。
   - 如果不确定，优先使用 `both`，不要随意猜测。

## 3. topic_tags（知识主题）

### 定义

`topic_tags` 是一个**数组**，包含 1-2 个主题标签，表示题目涉及的知识主题。

### 可选值

| 值 | 说明 | 日文 |
|---|---|---|
| `signs_and_markings` | 标志・标线（道路标志、路面标线） | 標識・標示 |
| `signals` | 信号灯（信号机、右转箭头、黄灯含义等） | 信号機 |
| `right_of_way` | 优先权 & 交叉路口（让行、优先道路、一时停止） | 優先権・交差点 |
| `overtake_lane_change` | 超车与变道（超车禁止、右侧车道使用等） | 追い越し・車線変更 |
| `parking_stopping` | 停车・停靠（停车禁止、临时停车、路边停车） | 駐車・停車 |
| `pedestrians_bicycles` | 行人・自行车・轻车相关规则 | 歩行者・自転車 |
| `driving_posture_operation` | 驾驶姿势与操作方法（起步、换挡、握方向盘等） | 運転姿勢・操作方法 |
| `speed_distance_following` | 车速、车距、安全间隔 | 速度・車間距離 |
| `weather_night_highway` | 恶劣天气、夜间驾驶、高速公路行驶 | 悪天候・夜間・高速道路 |
| `accident_emergency` | 事故发生后的处理与紧急应对 | 事故・緊急対応 |
| `penalties_points` | 罚则与扣分制度 | 罰則・減点 |
| `vehicle_maintenance` | 车辆构造、日常检查与维护 | 車両構造・点検 |
| `commercial_passenger` | 二種免許・营运载客特有规则 | 二種・営業載客 |
| `large_truck_special` | 大型货车・装载限制・制动距离等特例 | 大型貨物・特例 |
| `motorcycle_specific` | 二輪・原付特有规则（倾斜、二段右转等） | 二輪・原付特有 |
| `exam_procedure` | 考试流程、评分标准、考试场地规则 | 試験手順 |
| `other` | 不属于以上任何分类时使用 | その他 |

### 选择规则

1. 从列表中选择 **1-2 个** 最相关的主题标签。
2. 如果没有合适的主题，使用 `other`。
3. 不要创造新标签。

## 数据库字段

### questions 表

| 字段名 | 类型 | 说明 |
|---|---|---|
| `license_type_tag` | `TEXT[]` | 驾照类型标签（数组，可包含多个值） |
| `stage_tag` | `VARCHAR(20)` | 阶段标签（单个值） |
| `topic_tags` | `TEXT[]` | 主题标签数组（1-2个） |
| `category` | `VARCHAR(50)` | 题目分类（卷类，如 "12"）⚠️ 不是标签 |
| `license_types` | `TEXT[]` | 兼容旧字段（数组）⚠️ 已废弃，使用 `license_type_tag` 替代 |

### 注意事项

- `category` 是**卷类**（如 "仮免-1"、"免许-1"），不是标签，不要与标签混淆。
- `license_types` 是旧字段（数组），已废弃，使用 `license_type_tag`（单个值）替代。

## AI Prompt 输出格式

AI 自动打标签时，必须输出以下 JSON 格式：

```json
{
  "licenseTypeTag": "ordinary",
  "stageTag": "provisional",
  "topicTags": ["signals"]
}
```

或多个驾照类型：
```json
{
  "licenseTypeTag": ["ordinary", "medium"],
  "stageTag": "provisional",
  "topicTags": ["signals"]
}
```

### 字段说明

- `licenseTypeTag`：驾照类型标签（可以是单个值或数组）
- `stageTag`：阶段标签（单个值）
- `topicTags`：主题标签数组（1-2个）

⚠️ **重要**：
- 键名必须使用驼峰命名（`licenseTypeTag`、`stageTag`、`topicTags`）
- `licenseTypeTag` 可以是单个值（字符串）或数组（字符串数组）
- 不要输出 `category` 字段（category 是卷类，不是标签）
- 不要输出 `license_types` 或 `license_tags` 字段（使用 `licenseTypeTag` 替代）

## 代码使用

### 导入类型和函数

```typescript
import {
  LicenseTypeTag,
  StageTag,
  TopicTag,
  isLicenseTypeTag,
  isStageTag,
  isTopicTag,
  normalizeAIResult,
  type NormalizedQuestionTags,
} from "@/lib/quizTags";
```

### 规范化 AI 返回结果

```typescript
const raw = await aiService.generateTags(question);
const normalized = normalizeAIResult(raw);

// normalized 包含：
// - licenseTypeTag: LicenseTypeTag
// - stageTag: StageTag
// - topicTags: TopicTag[] (1-2个)
```

### 写入数据库

```typescript
await db
  .updateTable("questions")
  .set({
    license_type_tag: normalized.licenseTypeTag, // 数组格式
    stage_tag: normalized.stageTag, // 注意：可能需要转换为旧值 "regular" 以兼容
    topic_tags: normalized.topicTags,
  })
  .where("id", "=", questionId)
  .execute();
```

## 常见错误

### ❌ 错误示例

1. **把阶段信息塞进 license_type_tag**
   ```json
   {
     "licenseTypeTag": "provisional",  // ❌ 错误：provisional 是阶段，不是驾照类型
     "stageTag": "provisional"
   }
   ```

2. **把驾照类型塞进 topic_tags**
   ```json
   {
     "licenseTypeTag": "ordinary",
     "topicTags": ["car", "signals"]  // ❌ 错误：car 不是主题标签
   }
   ```

3. **把 category（卷类）当作标签**
   ```json
   {
     "category": "12",  // ❌ 错误：category 是卷类，不是标签
     "licenseTypeTag": "ordinary"
   }
   ```

### ✅ 正确示例

单个驾照类型：
```json
{
  "licenseTypeTag": "common_all",
  "stageTag": "both",
  "topicTags": ["signals", "right_of_way"]
}
```

多个驾照类型：
```json
{
  "licenseTypeTag": ["ordinary", "medium"],
  "stageTag": "both",
  "topicTags": ["signals", "right_of_way"]
}
```

## 迁移指南

### 从旧字段迁移

如果现有代码使用了 `license_types`（数组），需要迁移到 `license_type_tag`（单个值）：

```typescript
// 旧代码
const licenseTypes = question.license_types; // string[]

// 新代码
const licenseTypeTag = question.license_type_tag; // string | null
```

### 兼容性处理

为了向后兼容，系统会同时支持：
- 新字段：`license_type_tag`（单个值）
- 旧字段：`license_types`（数组，已废弃）

但新代码应该只使用 `license_type_tag`。

## 相关文件

- **类型定义**：`src/lib/quizTags.ts`
- **数据库迁移**：`src/migrations/20250122_add_license_type_tag.sql`
- **AI Prompt 更新**：`src/migrations/20250122_update_question_category_tags_prompt.sql`
- **解析逻辑**：`src/app/api/admin/question-processing/_lib/batchProcessUtils.ts`

## 更新历史

- **2025-01-22**：统一标签系统，明确区分三个维度，修复 AI 错误地把 category 打了标签的问题

