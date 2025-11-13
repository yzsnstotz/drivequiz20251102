# AI 图片支持实现计划

## 📋 当前状态

- ❌ **不支持上传图片**
- ❌ **不支持回复图片**
- ✅ 只支持文本问答

## 🎯 如果要支持图片识别（题目图片识别）

### 方案：使用 OpenAI Vision 模型

OpenAI 的 Vision 模型（如 `gpt-4o`、`gpt-4-turbo`）支持图片识别。

### 需要修改的部分

#### 1. 前端（AIPage.tsx）

**添加图片上传功能**：
```typescript
// 添加图片上传组件
const [images, setImages] = useState<File[]>([]);

// 将图片转换为 base64
const convertToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

// 修改请求体，包含图片
const requestBody = {
  question: q,
  locale: locale,
  images: images.length > 0 ? await Promise.all(images.map(convertToBase64)) : undefined,
};
```

#### 2. 主站 API（/api/ai/ask/route.ts）

**修改请求体类型**：
```typescript
type AskRequest = {
  question: string;
  locale?: string;
  images?: string[]; // base64 编码的图片数组
};
```

**转发到 AI-Service**：
```typescript
const forwardPayload = {
  question,
  locale,
  images: body.images, // 转发图片数据
  userId: session?.userId || null,
};
```

#### 3. AI-Service（apps/ai-service/src/routes/ask.ts）

**修改请求体类型**：
```typescript
type AskBody = {
  question?: string;
  userId?: string;
  lang?: string;
  images?: string[]; // base64 编码的图片数组
};
```

**修改 OpenAI API 调用，支持多模态**：
```typescript
// 使用支持 vision 的模型（如 gpt-4o）
const model = await getModelFromConfig(); // 需要改为 gpt-4o 或 gpt-4-turbo

// 构建消息内容（支持文本 + 图片）
const userContent: Array<{ type: "text" | "image_url"; text?: string; image_url?: { url: string } }> = [
  { type: "text", text: `${userPrefix} ${question}\n\n${refPrefix}\n${reference || "（無/None）"}` },
];

// 添加图片
if (images && images.length > 0) {
  for (const imageBase64 of images) {
    userContent.push({
      type: "image_url",
      image_url: { url: imageBase64 }, // 或使用 data:image/jpeg;base64,...
    });
  }
}

const completion = await openai.chat.completions.create({
  model: model, // 必须是支持 vision 的模型
  temperature: 0.4,
  messages: [
    { role: "system", content: sys },
    {
      role: "user",
      content: userContent, // 数组格式，包含文本和图片
    },
  ],
});
```

#### 4. 模型配置

**需要切换到支持 vision 的模型**：
- `gpt-4o`（推荐，支持 vision，价格适中）
- `gpt-4-turbo`（支持 vision，价格较高）
- `gpt-4-vision-preview`（旧版 vision 模型）

**在 AI-Service 环境变量或数据库配置中**：
```
AI_MODEL=gpt-4o
```

### 成本考虑

**Vision 模型价格**（OpenAI 定价）：
- `gpt-4o`：
  - Input: $2.50 / 1M tokens
  - Output: $10.00 / 1M tokens
  - 图片：每张图片约 85-170 tokens（取决于分辨率）
- `gpt-4o-mini`（当前使用）：
  - Input: $0.15 / 1M tokens
  - Output: $0.60 / 1M tokens
  - ❌ **不支持 vision**

**成本增加**：
- 使用 vision 模型成本会增加约 **16-66 倍**
- 每张图片约消耗 85-170 tokens
- 需要根据实际使用情况评估成本

### 实现步骤

1. **评估需求**：
   - 是否真的需要图片识别？
   - 用户能否用文字描述图片内容？
   - 成本是否可接受？

2. **如果决定实现**：
   - 修改前端，添加图片上传组件
   - 修改后端 API，支持图片数据
   - 修改 AI-Service，使用 vision 模型
   - 更新模型配置为 `gpt-4o`
   - 更新成本估算逻辑

3. **测试**：
   - 测试图片上传功能
   - 测试图片识别准确性
   - 测试成本估算

### 替代方案

如果成本太高，可以考虑：

1. **用户描述图片**：
   - 让用户用文字描述图片内容
   - AI 基于描述回答问题
   - 成本低，但可能不够准确

2. **预存储图片描述**：
   - 在题目数据中预先存储图片描述
   - AI 基于描述回答问题
   - 成本低，但需要人工标注

3. **混合方案**：
   - 默认使用文本问答（低成本）
   - 可选图片识别（高成本，按需使用）
   - 用户可以选择是否使用图片识别

---

## 📝 总结

**当前状态**：不支持图片上传和识别

**如果要支持**：
- 需要修改前端、后端、AI-Service
- 需要切换到 vision 模型（如 `gpt-4o`）
- 成本会增加 16-66 倍
- 需要评估是否值得

**建议**：
- 如果用户能描述图片内容，可以先不实现
- 如果确实需要，可以考虑混合方案（可选功能）










