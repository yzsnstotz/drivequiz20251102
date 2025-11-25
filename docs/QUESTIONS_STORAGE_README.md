# 题目存储和使用说明

## 题目存储方式

### 1. 存储位置
题目数据存储在文件系统中的 JSON 文件：
- **目录路径**：`src/data/questions/zh/`
- **文件格式**：`{卷类名称}.json`

### 2. 文件命名规则
文件按卷类命名，目前有以下卷类：
- `仮免-1.json` 到 `仮免-5.json`（仮免许相关）
- `免许-1.json` 到 `免许-6.json`（正式免许相关）
- `學科講習-1.json` 到 `學科講習-4.json`（学科讲习相关）
- `12.json`、`92.json`（其他分类）

### 3. 数据结构
每个 JSON 文件包含一个 `questions` 数组，题目对象结构如下：

```typescript
interface Question {
  id: number;                    // 题目ID
  type: "single" | "multiple" | "truefalse";  // 题目类型
  content: string;               // 题目内容
  options?: string[];           // 选项（单选题/多选题）
  correctAnswer: string | string[];  // 正确答案（单选为字符串，多选为字符串数组）
  image?: string;                // 题目图片URL（可选）
  explanation?: string;          // 解析说明（可选）
  category?: string;             // 卷类信息（可选）
}
```

### 4. 示例数据
```json
{
  "questions": [
    {
      "id": 1,
      "type": "truefalse",
      "content": "由于安全带在发生交通事故时可以大大地减少伤害，驾驶后排座位有安全带的车的驾驶员让后排的同乘者也系上了安全带。",
      "correctAnswer": "true",
      "explanation": ""
    },
    {
      "id": 2,
      "type": "single",
      "content": "在交叉路口，以下哪种行为是正确的？",
      "options": ["选项A", "选项B", "选项C", "选项D"],
      "correctAnswer": "选项A",
      "image": "https://example.com/image.png",
      "explanation": "解析说明"
    }
  ]
}
```

## 题目使用方式

### 1. 前端页面加载

#### 学习页面（StudyPage）
```typescript
// 动态导入 JSON 文件
const response = await import(`../../data/questions/zh/${questionSet.title}.json`);
setQuestions(response.questions);
```

#### 考试页面（ExamPage）
```typescript
// 从指定卷类加载题目
const response = await import(`../../data/questions/zh/仮免-1.json`);
const allQuestions = response.questions;

// 随机选择题目
const selectedQuestions = allQuestions
  .sort(() => Math.random() - 0.5)
  .slice(0, examSet.totalQuestions);
```

#### 大乱斗页面（RoyalBattlePage）
```typescript
// 加载所有类型的题目
const categories = ['學科講習', '仮免', '免许'];
let allQuestions: Question[] = [];

for (const category of categories) {
  for (let i = 1; i <= 6; i++) {
    try {
      const response = await import(`../../data/questions/zh/${category}-${i}.json`);
      allQuestions = [...allQuestions, ...response.questions];
    } catch (error) {
      console.log(`No questions found for ${category}-${i}`);
    }
  }
}

// 使用 Fisher-Yates 洗牌算法打乱题目
for (let i = allQuestions.length - 1; i > 0; i--) {
  const j = Math.floor(Math.random() * (i + 1));
  [allQuestions[i], allQuestions[j]] = [allQuestions[j], allQuestions[i]];
}
```

### 2. 后端 API 加载

#### 管理 API（/api/admin/questions）
```typescript
// 题目数据目录
const QUESTIONS_DIR = path.join(process.cwd(), "src/data/questions/zh");

// 加载指定卷类的题目文件
async function loadQuestionFile(category: string): Promise<QuestionFile | null> {
  const filePath = path.join(QUESTIONS_DIR, `${category}.json`);
  const content = await fs.readFile(filePath, "utf-8");
  return JSON.parse(content) as QuestionFile;
}

// 保存题目文件
async function saveQuestionFile(category: string, data: QuestionFile): Promise<void> {
  const filePath = path.join(QUESTIONS_DIR, `${category}.json`);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
}
```

### 3. 用户进度保存

学习进度保存在浏览器的 `localStorage` 中：
- **存储键**：`progress_{卷类名称}`，例如 `progress_仮免-1`
- **存储内容**：
  ```json
  {
    "currentIndex": 10,           // 当前题目索引
    "correctAnswers": 8,         // 正确答案数
    "totalQuestions": 50,        // 总题目数
    "answeredQuestions": [1,2,3]  // 已回答的题目索引数组
  }
  ```

## 题目管理功能

### 1. 后端管理 API

#### GET /api/admin/questions
- 获取所有题目列表（分页、筛选、排序）
- 支持按卷类筛选
- 支持搜索题目内容

#### POST /api/admin/questions
- 创建新题目
- 自动分配到对应卷类

#### GET /api/admin/questions/:id
- 获取单个题目详情

#### PUT /api/admin/questions/:id
- 更新题目信息

#### DELETE /api/admin/questions/:id
- 删除题目

#### POST /api/admin/questions/import
- 从 Excel 批量导入题目

### 2. 前端管理页面

- **路径**：`/admin/questions`
- **功能**：
  - 查看所有题目
  - 按卷类筛选
  - 搜索题目
  - 创建/编辑/删除题目
  - 批量导入题目

## 题目类型说明

### 1. truefalse（判断题）
- `type`: "truefalse"
- `correctAnswer`: "true" 或 "false"
- 不需要 `options`

### 2. single（单选题）
- `type`: "single"
- `options`: 选项数组（通常4个选项）
- `correctAnswer`: 单个选项字符串

### 3. multiple（多选题）
- `type`: "multiple"
- `options`: 选项数组
- `correctAnswer`: 选项字符串数组（如 ["选项A", "选项C"]）

## 优势与限制

### 优势
1. ✅ **简单直接**：JSON 文件易于理解和编辑
2. ✅ **版本控制友好**：可以通过 Git 跟踪题目变更
3. ✅ **无需数据库**：减少数据库依赖
4. ✅ **快速加载**：前端可以直接导入，无需 API 请求

### 限制
1. ❌ **扩展性受限**：大量题目时性能可能下降
2. ❌ **并发编辑困难**：文件系统不适合多用户同时编辑
3. ❌ **查询功能有限**：无法进行复杂的数据库查询
4. ❌ **缺少事务支持**：文件操作无法回滚

## 未来改进建议

如果题目数量增长或需要更复杂的功能，可以考虑：
1. **迁移到数据库**：使用 PostgreSQL 存储题目
2. **混合方案**：数据库存储题目，JSON 文件作为备份/导入导出格式
3. **内容管理系统**：专门的题目管理后台，支持批量操作、审核流程等

