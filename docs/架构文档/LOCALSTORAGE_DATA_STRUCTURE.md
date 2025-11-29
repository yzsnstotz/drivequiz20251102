# LocalStorage 数据结构说明

本文档说明当前服务中 localStorage 里 JSON 包和 aiAnswer 的数据结构。

## 一、JSON 包数据结构

### 1.1 存储键名

- **版本号键**: `dq_questions_package_current_version` (字符串)
- **包数据键**: `dq_questions_package_v_{version}` (字符串，其中 `{version}` 是版本号)

### 1.2 数据结构

JSON 包存储在 localStorage 中的结构如下：

```typescript
interface UnifiedPackage {
  version?: string;                    // 包版本号，例如 "1.0.0"
  questions?: Question[];              // 题目数组
  aiAnswers?: Record<string, string>;  // AI 答案映射表（key: questionHash, value: AI答案）
}
```

### 1.3 Question 对象结构

```typescript
interface Question {
  id: number;                          // 题目ID（唯一标识）
  type: "single" | "multiple" | "truefalse";  // 题目类型
  content: string;                     // 题目内容（问题文本）
  image?: string;                      // 题目图片URL（可选）
  options?: string[];                  // 选项数组（单选题/多选题，可选）
  correctAnswer: string | string[];   // 正确答案
                                        // - 单选题/判断题: string
                                        // - 多选题: string[]
  explanation?: string;                // 解析说明（可选）
  hash?: string;                       // 题目hash值（用于匹配AI答案，可选）
  category?: string;                   // 卷类信息，例如 "仮免-1", "免许-1"（可选）
}
```

### 1.4 完整示例

```json
{
  "version": "1.0.0",
  "questions": [
    {
      "id": 1,
      "type": "truefalse",
      "content": "由于安全带在发生交通事故时可以大大地减少伤害，驾驶后排座位有安全带的车的驾驶员让后排的同乘者也系上了安全带。",
      "correctAnswer": "true",
      "explanation": "根据日本交通法规，后排乘客也应系安全带。",
      "hash": "a1b2c3d4e5f6...",
      "category": "仮免-1"
    },
    {
      "id": 2,
      "type": "single",
      "content": "在交叉路口，以下哪种行为是正确的？",
      "options": [
        "选项A：减速观察",
        "选项B：加速通过",
        "选项C：按喇叭",
        "选项D：随意变道"
      ],
      "correctAnswer": "选项A：减速观察",
      "image": "https://example.com/image.png",
      "explanation": "在交叉路口应减速观察，确保安全。",
      "hash": "b2c3d4e5f6a7...",
      "category": "仮免-1"
    },
    {
      "id": 3,
      "type": "multiple",
      "content": "以下哪些行为是违法的？",
      "options": [
        "选项A：酒后驾驶",
        "选项B：超速行驶",
        "选项C：遵守交通规则",
        "选项D：疲劳驾驶"
      ],
      "correctAnswer": ["选项A：酒后驾驶", "选项B：超速行驶", "选项D：疲劳驾驶"],
      "explanation": "酒后驾驶、超速行驶和疲劳驾驶都是违法行为。",
      "hash": "c3d4e5f6a7b8...",
      "category": "仮免-1"
    }
  ],
  "aiAnswers": {
    "a1b2c3d4e5f6...": "根据日本交通法规，后排乘客必须系安全带。这是为了在发生交通事故时减少伤害。驾驶员有责任确保所有乘客都系好安全带。",
    "b2c3d4e5f6a7...": "在交叉路口，正确的行为是减速观察。这是为了确保安全，避免与其他车辆或行人发生碰撞。",
    "c3d4e5f6a7b8...": "酒后驾驶、超速行驶和疲劳驾驶都是违法行为。这些行为会严重影响驾驶安全，可能导致交通事故。"
  }
}
```

## 二、aiAnswers 数据结构

### 2.1 存储位置

`aiAnswers` 是 `UnifiedPackage` 对象的一个属性，与 `questions` 一起存储在 localStorage 中。

### 2.2 数据结构

```typescript
type aiAnswers = Record<string, string>;
```

- **键 (key)**: `questionHash` (string) - 题目的 hash 值
- **值 (value)**: AI 答案文本 (string)

### 2.3 Hash 计算方式

题目的 hash 值通常通过以下方式计算：
- 对题目内容进行规范化（去除多余空格、转换为小写等）
- 使用 SHA-256 算法计算 hash
- 返回十六进制字符串

### 2.4 使用示例

```typescript
// 从 localStorage 加载 aiAnswers
import { loadAiAnswers } from "@/lib/questionsLoader";

const aiAnswers = await loadAiAnswers();
// 返回: { "hash1": "答案1", "hash2": "答案2", ... }

// 根据 questionHash 获取 AI 答案
const questionHash = "a1b2c3d4e5f6...";
const answer = aiAnswers[questionHash];
// 返回: "根据日本交通法规，后排乘客必须系安全带..."
```

### 2.5 完整示例

```json
{
  "a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456": "根据日本交通法规，后排乘客必须系安全带。这是为了在发生交通事故时减少伤害。驾驶员有责任确保所有乘客都系好安全带。",
  "b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123457": "在交叉路口，正确的行为是减速观察。这是为了确保安全，避免与其他车辆或行人发生碰撞。减速观察可以帮助驾驶员及时发现潜在的危险。",
  "c3d4e5f6789012345678901234567890abcdef1234567890abcdef123458": "酒后驾驶、超速行驶和疲劳驾驶都是违法行为。这些行为会严重影响驾驶安全，可能导致交通事故。驾驶员应该严格遵守交通法规，确保自身和他人的安全。"
}
```

## 三、LocalStorage 键值说明

### 3.1 题目包相关键

| 键名 | 类型 | 说明 | 示例 |
|------|------|------|------|
| `dq_questions_package_current_version` | string | 当前使用的包版本号 | `"1.0.0"` |
| `dq_questions_package_v_{version}` | string | 版本化的包数据（JSON字符串） | `dq_questions_package_v_1.0.0` |

### 3.2 其他相关键

| 键名 | 类型 | 说明 |
|------|------|------|
| `USER_TOKEN` | string | 用户认证 token |
| `user_nickname` | string | 用户昵称 |
| `progress_{题目集名称}` | string | 学习进度（JSON字符串） |
| `mistakeBook` | string | 错题本（JSON字符串） |
| `examHistory` | string | 考试历史（JSON字符串） |
| `practiceHistory` | string | 做题历史（JSON字符串） |
| `AI_CHAT_HISTORY` | string | AI聊天历史（JSON字符串） |
| `drive-quiz-activated` | string | 激活状态 |
| `drive-quiz-email` | string | 激活邮箱 |

## 四、数据加载流程

### 4.1 加载题目包

```typescript
import { loadUnifiedQuestionsPackage } from "@/lib/questionsLoader";

// 1. 从 localStorage 读取版本号
const localVersion = getLocalPackageVersion(); // "1.0.0"

// 2. 请求服务器最新版本号
const latestVersion = await getLatestPackageVersion(); // "1.0.1"

// 3. 比较版本号
if (localVersion === latestVersion) {
  // 版本一致，从 localStorage 读取缓存
  const cached = getCachedPackage(latestVersion);
  return cached;
} else {
  // 版本不一致，从服务器下载最新版本
  const pkg = await fetchUnifiedPackage();
  cachePackage(pkg.version, pkg); // 保存到 localStorage
  return pkg;
}
```

### 4.2 加载 AI 答案

```typescript
import { loadAiAnswers } from "@/lib/questionsLoader";

// 从 UnifiedPackage 中提取 aiAnswers
const aiAnswers = await loadAiAnswers();
// 返回: { "hash1": "答案1", "hash2": "答案2", ... }
```

## 五、注意事项

1. **版本管理**: 每个版本的数据包都单独存储，键名包含版本号，避免版本冲突。

2. **数据大小**: localStorage 有大小限制（通常 5-10MB），如果题目和 AI 答案数据过大，可能需要考虑其他存储方案。

3. **数据同步**: 当服务器版本更新时，会自动下载新版本并更新 localStorage。

4. **Hash 匹配**: AI 答案通过 `questionHash` 与题目匹配，确保每个题目都能找到对应的 AI 解析。

5. **数据格式**: 所有数据都以 JSON 字符串形式存储在 localStorage 中，使用时需要 `JSON.parse()` 解析。

